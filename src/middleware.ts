import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isDevBypass, readLineConfig, verifySession } from "@/lib/auth";

/** 保護後台與後台用的 API。客戶端的預約流程不受影響。 */
export const config = {
  matcher: ["/admin/:path*", "/api/appointments/:path*"]
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 登入頁本身不能擋，否則會無限轉圈
  if (pathname.startsWith("/admin/login")) return NextResponse.next();

  if (isDevBypass()) return NextResponse.next();

  const line = readLineConfig();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const userId = line ? await verifySession(token, line.secret) : null;

  if (userId) return NextResponse.next();

  // API 回 401，頁面導去登入
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "需要登入" }, { status: 401 });
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}
