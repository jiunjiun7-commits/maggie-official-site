import { NextResponse } from "next/server";
import { runMarketRadarSync } from "@/lib/market-radar-orchestration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Maggie 已在 Vercel Dashboard → Production Deployment → Resources 直接確認這支 Function
// 目前平台允許到 ≤300 秒（不是我方猜測或文件推論）。本機完整跑完一次約 26-27 秒
// （見 src/lib/market-radar-orchestration.ts 的 checkpoint 記錄），Production 環境的冷啟動與
// 對外部（政府開放資料、Supabase）的網路延遲可能更慢，這裡抓 120 秒：比本機實測時間留出
// 約 4 倍餘裕，同時不會直接頂到平台上限——頂到上限的意義不大，卡住時應該讓它在合理時間內
// 失敗、留下 checkpoint 供排查，而不是放到 300 秒才發現卡死。只設定這一支 route，
// 不影響其他 API 路由的預設值。
export const maxDuration = 120;

/**
 * Vercel Cron 專用入口，刻意放在 /api/cron/* 而不是 /api/market-radar/*——後者被
 * src/middleware.ts 的 matcher 攔截，需要 LINE 登入 session cookie，Vercel Cron 的請求
 * 只會帶 `Authorization: Bearer $CRON_SECRET`、沒有 cookie，放在被攔截的路徑下會被
 * middleware 先擋成「需要登入」401，永遠打不到這支 route 自己的 CRON_SECRET 驗證。
 *
 * 這裡只負責：驗證 → 呼叫既有 orchestration → 回傳精簡 summary，不重寫任何 orchestration
 * 邏輯（見 src/lib/market-radar-orchestration.ts）。
 *
 * Phase 9B 範圍：orchestration 跑到 pending notification / digest 組字就停止，
 * 不呼叫 LINE push、不寫 official_transaction_area_notifications——這是刻意的，
 * 自動 LINE 發送要等下一階段明確授權才會加上去。
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "尚未設定 CRON_SECRET，拒絕執行。" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ ok: false, error: "缺少 Authorization header。" }, { status: 401 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Authorization 不正確。" }, { status: 401 });
  }

  try {
    // radar_sync_runs.run_type 的 check constraint 只允許 'scheduled' | 'manual'，沒有 'cron'
    // 這個值，Cron 觸發的執行語意上就是 'scheduled'，這裡不新增 schema、沿用既有兩個合法值。
    const summary = await runMarketRadarSync("scheduled");
    return NextResponse.json({
      ok: true,
      status: summary.status,
      startedAt: summary.startedAt,
      finishedAt: summary.finishedAt,
      sourceSeason: summary.sourceSeason,
      fetched: summary.fetched,
      inserted: summary.inserted,
      duplicatesSkipped: summary.duplicatesSkipped,
      geocodePending: summary.geocodePending,
      geocodeResolved: summary.geocodeResolved,
      geocodeFailed: summary.geocodeFailed,
      areaMatched: summary.areaMatched,
      communityAutoMatched: summary.communityAutoMatched,
      communityNeedsConfirmation: summary.communityNeedsConfirmation,
      communityNoCommunity: summary.communityNoCommunity,
      pendingNotificationCount: summary.pendingNotificationCount,
      digestLength: summary.digestLength,
      notificationNeeded: summary.notificationNeeded,
      areaBreakdown: summary.areaBreakdown,
      errors: summary.errors
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "執行失敗" }, { status: 500 });
  }
}
