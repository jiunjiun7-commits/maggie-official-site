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
