import { NextResponse } from "next/server";
import { readLineConfig } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "line_oauth_state";

export async function GET(request: Request) {
  const config = readLineConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/admin/login?error=unconfigured", request.url));
  }

  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const redirectUri = `${url.origin}/api/auth/line/callback`;

  const authorize = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", config.channelId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("scope", "profile openid");

  const response = NextResponse.redirect(authorize.toString());
  // state 用來擋 CSRF，只留 10 分鐘
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 600
  });
  return response;
}
