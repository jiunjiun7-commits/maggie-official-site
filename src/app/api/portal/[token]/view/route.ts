import { NextResponse } from "next/server";
import { resolveSellerIdByToken } from "@/lib/seller-portal";
import { recordPortalView } from "@/lib/seller-portal-views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 屋主開啟週報時由瀏覽器回報一次。
 *
 * 為什麼不在 Portal 的 server component 直接記錄：那樣連 LINE／Messenger 產生
 * 連結預覽的爬蟲抓取都會被算成「屋主看過了」，後台會顯示假的已開啟。
 * 改由真實瀏覽器執行 JS 後才回報，準確得多。
 *
 * 這條路由在 middleware 的 matcher 之外（跟 /portal 一樣是公開的），
 * 但要有正確的 token 才寫得進去，猜不到 token 就記不了任何東西。
 */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const sellerId = await resolveSellerIdByToken(token);
  if (!sellerId) return NextResponse.json({ ok: false }, { status: 404 });

  await recordPortalView(sellerId);
  return NextResponse.json({ ok: true });
}
