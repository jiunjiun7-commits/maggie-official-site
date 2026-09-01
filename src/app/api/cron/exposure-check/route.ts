import { NextResponse } from "next/server";
import { runExposureCheck } from "@/lib/seller-exposure-checker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Vercel Cron 專用入口，放在 /api/cron/* 而不是 /api/sellers/*——後者被 src/middleware.ts
 * 的 matcher 攔截，需要 LINE 登入 session cookie，Vercel Cron 的請求只會帶
 * `Authorization: Bearer $CRON_SECRET`、沒有 cookie，放在被攔截的路徑下會被 middleware
 * 先擋成「需要登入」401，永遠打不到這支 route 自己的 CRON_SECRET 驗證（沿用
 * src/app/api/cron/market-radar/route.ts 的既有寫法，同一個已設定好的環境變數）。
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
    const summary = await runExposureCheck();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "執行失敗" }, { status: 500 });
  }
}
