/**
 * LINE Messaging API — push 訊息（MVP：純文字、手動觸發、只推給單一 userId）。
 *
 * 跟 src/lib/auth.ts 的 LINE Login 是完全不同的 channel／用途，不要共用環境變數：
 * - LINE_LOGIN_CHANNEL_ID / LINE_LOGIN_CHANNEL_SECRET：後台登入用。
 * - LINE_MESSAGING_CHANNEL_ACCESS_TOKEN / LINE_NOTIFY_USER_ID：這支模組推播用。
 *
 * 這個 MVP 階段不做 webhook、不驗證簽章、不做 Flex Message，只有最單純的
 * 「呼叫 push API、回傳成功或失敗」，成功/失敗的判定完全交給呼叫端決定要不要
 * 寫入 official_transaction_area_notifications。
 */
import type { NotificationEvent } from "./market-radar-store";

export type LineMessagingConfig = {
  channelAccessToken: string;
  notifyUserId: string;
};

export function readLineMessagingConfig(): LineMessagingConfig | null {
  const channelAccessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  const notifyUserId = process.env.LINE_NOTIFY_USER_ID;
  if (!channelAccessToken || !notifyUserId) return null;
  return { channelAccessToken, notifyUserId };
}

function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("zh-TW");
}

/** 總價（元）→「3,800 萬」，只在顯示時換算，DB 原始總價（元）完全不動。 */
export function formatTotalPriceInWan(value: number | null): string {
  if (value === null || value === undefined) return "—";
  const wan = Math.round(value / 10000);
  return `${wan.toLocaleString("zh-TW")} 萬`;
}

/** 單價（元/坪）→「約 27.6 萬/坪」，四捨五入到小數點後 1 位，只在顯示時換算，DB 原始單價完全不動。 */
export function formatUnitPriceInWan(value: number | null): string {
  if (value === null || value === undefined) return "—";
  const wan = Math.round((value / 10000) * 10) / 10;
  return `約 ${wan.toFixed(1)} 萬/坪`;
}

/**
 * 純文字測試訊息，多區合併成同一則、列出全部命中的區域。
 * 樓層／社區都是「有乾淨資料才顯示，看不懂或沒有就整行不顯示」——不猜測、不硬湊格式。
 */
export function buildNotificationMessageText(event: NotificationEvent): string {
  const areaNames = event.matchedAreas.map((a) => a.areaName).join("、");
  const lines = [
    "【高雄房市情報雷達｜測試通知】",
    `區域：${areaNames}`,
    event.communityName ? `社區：${event.communityName}` : null,
    `地址：${event.address}`,
    `交易日期：${event.transactionDate ?? "—"}`,
    `總價：${formatTotalPriceInWan(event.totalPrice)}`,
    `單價：${formatUnitPriceInWan(event.unitPrice)}`,
    `建物坪數：${formatNumber(event.buildingAreaPing)} 坪`,
    event.floorNumber !== null && event.totalFloors !== null ? `樓層/總樓層：${event.floorNumber}/${event.totalFloors}` : null,
    "",
    "（這是手動測試發送，尚未接上自動排程）"
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}

/**
 * Phase 7｜每日摘要（MVP，只做資料聚合＋文字組裝，這個模組本身不呼叫任何送出邏輯）。
 *
 * 依區域分組：一筆交易若同時命中多個區域，會分別出現在每個命中區域的清單裡
 * （沿用 event.matchedAreas 既有語意，不额外去重成一筆）。同一區域內每筆交易各自列出，
 * 不因同社區合併——避免把不同戶的成交價揉在一起造成誤解。
 */
export type DigestAreaGroup = {
  areaId: string;
  areaName: string;
  events: NotificationEvent[];
};

export function groupPendingEventsByArea(events: NotificationEvent[]): DigestAreaGroup[] {
  const groups = new Map<string, DigestAreaGroup>();
  for (const event of events) {
    for (const area of event.matchedAreas) {
      const existing = groups.get(area.areaId);
      if (existing) {
        existing.events.push(event);
      } else {
        groups.set(area.areaId, { areaId: area.areaId, areaName: area.areaName, events: [event] });
      }
    }
  }
  return Array.from(groups.values())
    .map((g) => ({ ...g, events: [...g.events].sort((a, b) => (b.transactionDate ?? "").localeCompare(a.transactionDate ?? "")) }))
    .sort((a, b) => a.areaName.localeCompare(b.areaName, "zh-TW"));
}

/** 單筆交易在摘要裡的一段文字——社區沒有乾淨資料就不顯示該行，不猜測。 */
function buildDigestEventBlock(event: NotificationEvent): string {
  // 總價/單價/建物坪數：只有實際有值的欄位才會出現在這一行，缺值的欄位整個省略
  // （不顯示 —／null／0），避免造成「單價：—」這種看起來像有資料但其實沒有的誤導文字。
  const priceFields = [
    event.totalPrice !== null ? `總價：${formatTotalPriceInWan(event.totalPrice)}` : null,
    event.unitPrice !== null ? `單價：${formatUnitPriceInWan(event.unitPrice)}` : null,
    event.buildingAreaPing !== null ? `建物坪數：${formatNumber(event.buildingAreaPing)} 坪` : null
  ].filter((field): field is string => field !== null);

  const lines = [
    event.communityName ? `・${event.communityName}` : `・${event.address}`,
    event.communityName ? `　地址：${event.address}` : null,
    `　交易日期：${event.transactionDate ?? "—"}`,
    priceFields.length > 0 ? `　${priceFields.join("｜")}` : null,
    event.floorNumber !== null && event.totalFloors !== null ? `　樓層/總樓層：${event.floorNumber}/${event.totalFloors}` : null
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}

/** 單一區域的摘要區塊（含標題），用於檢查「若依區域拆分，各則大約多少字」。 */
export function buildAreaDigestSectionText(group: DigestAreaGroup): string {
  const lines = [`【${group.areaName}】共 ${group.events.length} 筆`, ...group.events.map((e) => buildDigestEventBlock(e))];
  return lines.join("\n");
}

/**
 * Phase 10.9｜格局（房/廳/衛），跟後台總覽（official-transaction-overview-store.ts）完全同一套
 * 顯示規則：三個值都缺，或官方原始資料三個都是 0（代表不是一般住宅格局，例如車位／整棟商用
 * 交易），都不算「有格局資料」，回傳 null（呼叫端據此決定整行不顯示），不顯示 0房0廳0衛。
 */
function formatLayout(event: NotificationEvent): string | null {
  const { roomCount, hallCount, bathCount } = event;
  if (roomCount === null || hallCount === null || bathCount === null) return null;
  if (roomCount === 0 && hallCount === 0 && bathCount === 0) return null;
  return `${roomCount}房${hallCount}廳${bathCount}衛`;
}

/** Phase 10.10.1｜社區名稱顯示用：「.」轉成「・」，只改顯示，不改 DB 原始 communities.name。 */
function toDisplayCommunityName(name: string): string {
  return name.replace(/\./g, "・");
}

/**
 * Phase 10.10.1｜地址顯示用：移除開頭的「高雄市{行政區}」固定前綴（標題已經有區域名稱，
 * 不需要每筆再重複讀一次縣市/行政區），只改顯示，DB 原始 official_transactions.address 完全不動。
 * 不是這個固定前綴格式（例如不是 resolved 地址、或行政區欄位跟地址開頭對不上）就整段照顯示，不硬切。
 */
function toDisplayAddress(address: string, district: string): string {
  const prefix = `高雄市${district}`;
  return address.startsWith(prefix) ? address.slice(prefix.length) : address;
}

/**
 * Phase 10.10.1｜單一區域訊息用的單筆交易區塊：每個資訊各自獨立一行（不再用「｜」把總價/單價/
 * 坪數擠在同一行），避免 LINE 手機版依螢幕寬度自動換行把單位（例如「萬/坪」）切到下一行。
 * 社區名稱與格局字數都短，維持同一行不會有這個問題。null 欄位整行省略，不顯示 —。
 */
function buildAreaSplitEventBlock(event: NotificationEvent): string {
  const layout = formatLayout(event);
  const lines = [
    event.communityName ? `🏠 ${toDisplayCommunityName(event.communityName)}${layout ? `｜${layout}` : ""}` : null,
    `📍 ${toDisplayAddress(event.address, event.district)}`,
    event.totalPrice !== null ? `💰 總價：${formatTotalPriceInWan(event.totalPrice)}` : null,
    event.unitPrice !== null ? `📊 單價：${formatUnitPriceInWan(event.unitPrice)}` : null,
    event.buildingAreaPing !== null ? `📐 建物：${formatNumber(event.buildingAreaPing)} 坪` : null,
    event.floorNumber !== null && event.totalFloors !== null ? `🏢 樓層：${event.floorNumber} / ${event.totalFloors}` : null,
    event.transactionDate ? `📅 成交：${event.transactionDate}` : null
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}

export const LINE_TEXT_MESSAGE_LIMIT = 5000;

function buildAreaSplitHeader(areaName: string, dateLabel: string, count: number, partIndex: number, totalParts: number): string {
  const title = totalParts > 1 ? `【高雄房市情報雷達｜${areaName} ${partIndex}/${totalParts}】` : `【高雄房市情報雷達｜${areaName}】`;
  return `${title}\n${dateLabel}｜新增成交 ${count} 筆`;
}

/**
 * Phase 10.9｜把「一個區域」的 pending events 拆成一則以上的 LINE 訊息，每則都在
 * LINE_TEXT_MESSAGE_LIMIT 以下，且絕不把同一筆交易拆到兩則裡（拆分永遠以完整的一筆為單位）。
 *
 * 做法：先組出每一筆交易各自的文字區塊，再貪婪地一筆一筆塞進「目前這一則」，一旦加進去會
 * 超過長度上限就開新的一則。因為最終訊息數（part 總數）在組完才知道，這裡先用「假設會拆成
 * 多則」的標題長度（例如「北美術 12/12」）當作長度預算的保守估計，確保之後不管實際拆成幾則，
 * 每一則都一定在限制內（標題數字越多位數只會讓預算更寬鬆，不會不夠）。
 *
 * Phase 10.10.1｜新增 mode 參數：'preview'（預設，保留「Preview／尚未接上自動排程」提示文字，
 * 給驗收腳本用）／'production'（正式發送用，不含任何提示文字）。呼叫端未指定時預設 preview，
 * 避免既有驗收腳本（Phase 10.9/10.10）行為改變；等之後真的要接上正式排程再由呼叫端明確傳
 * 'production'，這裡本身不會自動判斷、不影響 Cron 現有邏輯。
 */
export function buildAreaSplitDigestMessages(group: DigestAreaGroup, dateLabel: string, mode: "preview" | "production" = "preview"): string[] {
  if (group.events.length === 0) return [];

  const blocks = group.events.map((e) => buildAreaSplitEventBlock(e));
  const footer = mode === "preview" ? "\n\n（這是每日摘要 Preview，尚未接上自動排程）" : "";

  // 保守估計：假設最終會拆成跟「事件數」一樣多則（不可能比這更多），用這個上限先組標題長度。
  const worstCaseHeaderLength = buildAreaSplitHeader(group.areaName, dateLabel, blocks.length, blocks.length, blocks.length).length;
  const budgetPerMessage = LINE_TEXT_MESSAGE_LIMIT - worstCaseHeaderLength - footer.length - 4; // 4：標題與內容之間的換行預留

  const chunks: string[][] = [];
  let current: string[] = [];
  let currentLength = 0;
  for (const block of blocks) {
    const addedLength = block.length + (current.length > 0 ? 2 : 0); // 區塊間空一行
    if (current.length > 0 && currentLength + addedLength > budgetPerMessage) {
      chunks.push(current);
      current = [];
      currentLength = 0;
    }
    current.push(block);
    currentLength += block.length + (current.length > 1 ? 2 : 0);
  }
  if (current.length > 0) chunks.push(current);

  const totalParts = chunks.length;
  return chunks.map((chunkBlocks, idx) => {
    const header = buildAreaSplitHeader(group.areaName, dateLabel, chunkBlocks.length, idx + 1, totalParts);
    return `${header}\n\n${chunkBlocks.join("\n\n")}${footer}`;
  });
}

/** 完整每日摘要（全部區域合併成一則），dateLabel 例如「2026-08-24」。 */
export function buildDailyDigestText(groups: DigestAreaGroup[], dateLabel: string): string {
  if (groups.length === 0) return "";
  const totalCount = groups.reduce((sum, g) => sum + g.events.length, 0);
  const header = [`【高雄房市情報雷達｜每日摘要】${dateLabel}`, `今日新增 ${totalCount} 筆`, ""];
  const sections = groups.map((g) => buildAreaDigestSectionText(g));
  const footer = ["", "（這是每日摘要 Preview，尚未接上自動排程）"];
  return [...header, ...sections].join("\n\n") + footer.join("\n");
}

export type LinePushResult = { ok: true } | { ok: false; status: number; message: string };

/** 呼叫 LINE push API，回傳成功或失敗（含 HTTP 狀態與錯誤訊息，方便畫面直接顯示）。 */
export async function sendLinePushMessage(config: LineMessagingConfig, text: string): Promise<LinePushResult> {
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.channelAccessToken}`
    },
    body: JSON.stringify({
      to: config.notifyUserId,
      messages: [{ type: "text", text }]
    })
  });

  if (response.ok) return { ok: true };

  const body = await response.text();
  let message = body;
  try {
    const parsed = JSON.parse(body);
    message = parsed.message || body;
    if (Array.isArray(parsed.details) && parsed.details.length > 0) {
      message += `（${parsed.details.map((d: { message?: string }) => d.message).join("；")}）`;
    }
  } catch {
    // 保留原始文字
  }
  return { ok: false, status: response.status, message };
}
