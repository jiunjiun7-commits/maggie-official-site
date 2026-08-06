import { NextResponse } from "next/server";
import { SESSION_COOKIE, allowedUserIds, createSession, readLineConfig, sessionMaxAge } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "line_oauth_state";

function fail(request: Request, reason: string, extra?: Record<string, string>) {
  const url = new URL("/admin/login", request.url);
  url.searchParams.set("error", reason);
  Object.entries(extra || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const config = readLineConfig();
  if (!config) return fail(request, "unconfigured");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${STATE_COOKIE}=`))
    ?.split("=")[1];

  if (!code) return fail(request, "no_code");
  if (!state || !expectedState || state !== expectedState) return fail(request, "bad_state");

  // 用 authorization code 換 access token
  const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${url.origin}/api/auth/line/callback`,
      client_id: config.channelId,
      client_secret: config.channelSecret
    })
  });

  if (!tokenResponse.ok) return fail(request, "token_failed");
  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenData.access_token) return fail(request, "token_failed");

  // 取得 LINE 個人資料（只要 userId 與顯示名稱）
  const profileResponse = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  if (!profileResponse.ok) return fail(request, "profile_failed");
  const profile = (await profileResponse.json()) as { userId?: string; displayName?: string };
  if (!profile.userId) return fail(request, "profile_failed");

  const allowed = allowedUserIds();

  // 首次設定：白名單還沒填，把 userId 顯示出來讓使用者複製進環境變數
  if (allowed.length === 0) {
    return fail(request, "bootstrap", {
      uid: profile.userId,
      name: profile.displayName || ""
    });
  }

  if (!allowed.includes(profile.userId)) {
    return fail(request, "not_allowed");
  }

  const next = url.searchParams.get("next") || "/admin/appointments";
  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(SESSION_COOKIE, await createSession(profile.userId, config.secret), {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge()
  });
  response.cookies.delete(STATE_COOKIE);
  return response;
}
