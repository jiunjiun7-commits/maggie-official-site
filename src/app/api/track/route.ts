import { NextResponse } from "next/server";
import { isEventType, recordEvent } from "@/lib/events-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 遙測端點：一律回 204，sendBeacon 不會讀回應內容。
 * 公開站台要能匿名呼叫，所以路徑刻意不放在 /api/appointments/* 或 /admin/* 底下，
 * middleware.ts 不會擋這裡。沒有 rate limit——沒有外部成本，資料只有 service_role
 * 讀得到，個人房仲網站的流量規模不需要。
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const eventType = String(body.eventType || "");

  if (!isEventType(eventType)) {
    return new NextResponse(null, { status: 204 });
  }

  // 這裡要 await 完才能回應：Vercel 的 serverless function 一旦把回應送出去，
  // process 隨時可能被凍結，沒 await 的話 insert 有可能根本來不及送到 Supabase。
  // 對客戶端來說完全不影響速度——sendBeacon 本來就不等這個回應。
  await recordEvent(eventType);
  return new NextResponse(null, { status: 204 });
}
