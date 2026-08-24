/**
 * Phase 10.13｜LINE Daily Digest 正式發送邏輯（目前完全沒有被 orchestration.ts／Cron route 呼叫，
 * 純粹是準備好、可以獨立測試的模組——要真的接上 Cron 自動發送，需要另外明確授權才會去改
 * market-radar-orchestration.ts 或 /api/cron/market-radar/route.ts）。
 *
 * 設計重點：
 * - 每個區域各自獨立處理：一個區域的訊息全部（可能因為 5000 字上限拆成多則）都送成功，
 *   才會把該區域這批交易寫進 official_transaction_area_notifications；任何一則失敗，
 *   這個區域這批交易全部「不標記」，下次 Cron 重跑會整批重試（見下方「已知取捨」）。
 * - 區域之間互不影響：某區失敗不會擋住其他區域繼續嘗試發送。
 * - 只呼叫 sendLinePushMessage（單筆 push 給 LINE_NOTIFY_USER_ID），不 batch/broadcast/multicast。
 * - send/record 都可以從外部注入（deps 參數），方便測試時用假的 sender/recorder，不用真的打
 *   LINE API 或寫真的 DB。
 *
 * 已知取捨（刻意不隱藏）：如果一個區域拆成多則，前面幾則送成功、某一則中途失敗，因為採
 * 「全部成功才標記」，下次重跑會把已經送過的那幾則「也」重送一次（重複訊息），換取的是
 * 「絕對不會有交易被永久漏發」——兩害相權，選擇不遺漏優先於不重複，重複頂多是 Maggie 收到
 * 同一批資訊兩次，遺漏則是永遠不會知道有這筆成交。
 */
import type { NotificationEvent } from "./market-radar-store";
import { getNotificationCutoffAt, listPendingNotificationEventsAfter, recordNotificationsSent } from "./market-radar-store";
import type { LineMessagingConfig, LinePushResult, DigestAreaGroup } from "./line-messaging";
import { sendLinePushMessage, buildAreaSplitDigestMessages, groupPendingEventsByArea } from "./line-messaging";

export type LineSender = (config: LineMessagingConfig, text: string) => Promise<LinePushResult>;
export type NotificationRecorder = (officialTransactionId: string, areaIds: string[], channel: "line") => Promise<void>;

export type AreaSendResult = {
  areaId: string;
  areaName: string;
  status: "sent" | "failed";
  messagesSent: number;
  messagesTotal: number;
  transactionIds: string[];
  error?: string;
};

export type SendDigestsResult = {
  areaResults: AreaSendResult[];
  totalMessagesSent: number;
  totalTransactionsNotified: number;
};

/**
 * 對「已經算好的一批事件」依區域分組、組訊息、逐一發送、成功才記錄。不負責讀 cutoff／查 DB，
 * 純粹處理「給定事件清單 → 送出 → 回報結果」，方便用 fixture 測試而不用碰真的 DB／LINE API。
 */
export async function sendAreaDigestsForEvents(
  events: NotificationEvent[],
  config: LineMessagingConfig,
  dateLabel: string,
  deps: { send?: LineSender; record?: NotificationRecorder } = {}
): Promise<SendDigestsResult> {
  const send = deps.send ?? sendLinePushMessage;
  const record = deps.record ?? recordNotificationsSent;

  const groups: DigestAreaGroup[] = groupPendingEventsByArea(events);
  const areaResults: AreaSendResult[] = [];

  for (const group of groups) {
    if (group.events.length === 0) continue; // groupPendingEventsByArea 理論上不會產生空群組，防呆保留

    const messages = buildAreaSplitDigestMessages(group, dateLabel, "production");
    const transactionIds = [...new Set(group.events.map((e) => e.officialTransactionId))];

    let sentCount = 0;
    let failError: string | undefined;
    for (const text of messages) {
      const result = await send(config, text);
      if (!result.ok) {
        failError = `status=${result.status}｜${result.message}`;
        break; // 這個區域後面的訊息不再送，整批留給下次重跑（見上方已知取捨）
      }
      sentCount++;
    }

    const allSent = sentCount === messages.length;
    if (allSent) {
      // 全部訊息都成功，才把這個區域涉及的交易標記已通知；任何一筆寫入失敗都要讓整個
      // try 往外拋，不能悄悄吞掉——那樣會造成「LINE 已經送出但沒記錄」，下次又重送一次
      // （這種情況下重複優於遺漏的取捨依然成立，所以讓它拋出去、外層記錄失敗即可，
      // 不需要特殊處理，下次重跑一樣會走同一套「全部成功才標記」邏輯）。
      for (const txnId of transactionIds) {
        await record(txnId, [group.areaId], "line");
      }
      areaResults.push({
        areaId: group.areaId,
        areaName: group.areaName,
        status: "sent",
        messagesSent: sentCount,
        messagesTotal: messages.length,
        transactionIds
      });
    } else {
      areaResults.push({
        areaId: group.areaId,
        areaName: group.areaName,
        status: "failed",
        messagesSent: sentCount,
        messagesTotal: messages.length,
        transactionIds,
        error: failError
      });
    }
  }

  return {
    areaResults,
    totalMessagesSent: areaResults.reduce((sum, r) => sum + r.messagesSent, 0),
    totalTransactionsNotified: areaResults.filter((r) => r.status === "sent").reduce((sum, r) => sum + r.transactionIds.length, 0)
  };
}

/**
 * 正式入口：讀 cutoff → 撈 cutoff 後的待通知事件 → 發送。cutoff 沒設定時 fail-closed
 * （回傳空結果，不送任何東西），跟 orchestration.ts 摘要組字那段的行為一致。
 *
 * 目前沒有任何地方呼叫這支函式（orchestration.ts／Cron route 都還沒接線），
 * 純粹是準備好、可以獨立測試的正式發送入口。
 */
export async function sendCutoffNotifications(config: LineMessagingConfig, dateLabel: string): Promise<SendDigestsResult> {
  const cutoffAt = await getNotificationCutoffAt();
  if (cutoffAt === null) {
    return { areaResults: [], totalMessagesSent: 0, totalTransactionsNotified: 0 };
  }
  const events = await listPendingNotificationEventsAfter(cutoffAt);
  return sendAreaDigestsForEvents(events, config, dateLabel);
}
