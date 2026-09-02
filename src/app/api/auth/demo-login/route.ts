import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSession, sessionMaxAge } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demo/Beta 部署專用的共用密碼登入，取代正式站台的 LINE Login。
 *
 * 完全比照 src/app/api/auth/line/callback/route.ts 簽發 session 的方式（createSession + 同一組
 * SESSION_COOKIE），middleware.ts 完全不用改：只要 Demo 部署沒有設定 LINE_ALLOWED_USER_IDS，
 * verifySession() 的白名單檢查就會整段跳過，任何合法簽章的 session 都會被接受（見 auth.ts）。
 *
 * 這條路由只在設定了 DEMO_SHARED_PASSWORD 環境變數的部署上才會真的生效——正式站台沒有這個
 * 變數，打這支路由只會拿到「此功能未啟用」，不會有安全疑慮。
 */
export async function POST(request: Request) {
  const demoPassword = process.env.DEMO_SHARED_PASSWORD;
  const authSecret = process.env.AUTH_SECRET;

  function fail(reason: string) {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("error", reason);
    return NextResponse.redirect(url, { status: 303 });
  }

  if (!demoPassword || !authSecret) return fail("unconfigured");

  const form = await request.formData().catch(() => null);
  const password = String(form?.get("password") || "");
  if (password !== demoPassword) return fail("demo_wrong_password");

  const response = NextResponse.redirect(new URL("/admin/sellers", request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE, await createSession("demo-tester", authSecret), {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge()
  });
  return response;
}
