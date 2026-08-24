import { NextResponse } from "next/server";
import { getPendingNotificationEventById, recordNotificationsSent } from "@/lib/market-radar-store";
import { buildNotificationMessageText, readLineMessagingConfig, sendLinePushMessage } from "@/lib/line-messaging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendResult = {
  officialTransactionId: string;
  address: string | null;
  success: boolean;
  error?: string;
};

/**
 * 手動測試發送：逐筆獨立處理，互不拖累（同意過的設計）。
 * 每一筆都重新從資料庫查一次「這筆現在是不是還在待通知清單裡」，不信任前端傳來的內容，
 * 避免用舊資料/被竄改的內容發訊息，也避免對已經通知過的事件重複發送。
 * 只有 LINE API 回傳成功才會寫入 official_transaction_area_notifications；失敗完全不寫入。
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.officialTransactionIds) ? body.officialTransactionIds.filter((v: unknown) => typeof v === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "缺少 officialTransactionIds。" }, { status: 400 });
  }

  const config = readLineMessagingConfig();
  if (!config) {
    return NextResponse.json(
      { ok: false, error: "尚未設定 LINE_MESSAGING_CHANNEL_ACCESS_TOKEN / LINE_NOTIFY_USER_ID 環境變數，無法發送。" },
      { status: 500 }
    );
  }

  const results: SendResult[] = [];

  for (const id of ids) {
    const event = await getPendingNotificationEventById(id);
    if (!event) {
      results.push({ officialTransactionId: id, address: null, success: false, error: "這筆已經不在待通知清單裡（可能已經通知過，或資料已變動），已跳過。" });
      continue;
    }

    const text = buildNotificationMessageText(event);
    const pushResult = await sendLinePushMessage(config, text);

    if (pushResult.ok) {
      await recordNotificationsSent(
        event.officialTransactionId,
        event.matchedAreas.map((a) => a.areaId),
        "line"
      );
      results.push({ officialTransactionId: id, address: event.address, success: true });
    } else {
      results.push({
        officialTransactionId: id,
        address: event.address,
        success: false,
        error: `LINE API 回傳 ${pushResult.status}：${pushResult.message}`
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}
