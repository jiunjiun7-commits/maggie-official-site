/**
 * 後台身分驗證：LINE Login + 白名單。
 *
 * 設計重點：
 * - 用 Web Crypto 簽章，middleware（Edge runtime）與 route handler 都能用同一份程式碼。
 * - 失敗一律關門（fail closed）：正式環境沒設好環境變數就直接擋住後台，不會裸奔。
 * - 只有白名單裡的 LINE userId 進得來，光是「有 LINE 帳號」不夠。
 */

export const SESSION_COOKIE = "maggie_admin_session";
const SESSION_HOURS = 12;

export type LineConfig = {
  channelId: string;
  channelSecret: string;
  secret: string;
};

export function readLineConfig(): LineConfig | null {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  const secret = process.env.AUTH_SECRET;
  if (!channelId || !channelSecret || !secret) return null;
  return { channelId, channelSecret, secret };
}

/** 允許進後台的 LINE userId。留空代表尚未完成設定（第一次登入時會顯示你的 userId）。 */
export function allowedUserIds(): string[] {
  return (process.env.LINE_ALLOWED_USER_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/** 開發模式下允許直接看後台，方便本機測試；正式環境一律要求登入。 */
export function isDevBypass() {
  return process.env.NODE_ENV === "development";
}

/* ---------- 簽章 ---------- */

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function sign(payload: string, secret: string) {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

/** 產生一個有時效的 session token。 */
export async function createSession(userId: string, secret: string) {
  const payload = toBase64Url(
    new TextEncoder().encode(
      JSON.stringify({ sub: userId, exp: Date.now() + SESSION_HOURS * 3600_000 })
    )
  );
  return `${payload}.${await sign(payload, secret)}`;
}

/** 驗證 token；通過回傳 userId，否則回傳 null。 */
export async function verifySession(token: string | undefined, secret: string) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(signature),
    new TextEncoder().encode(payload)
  );
  if (!valid) return null;

  try {
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    if (typeof data.sub !== "string" || !data.sub) return null;
    // session 發出後白名單可能被改，所以這裡要再檢查一次
    const allowed = allowedUserIds();
    if (allowed.length && !allowed.includes(data.sub)) return null;
    return data.sub as string;
  } catch {
    return null;
  }
}

export function sessionMaxAge() {
  return SESSION_HOURS * 3600;
}
