import crypto from "node:crypto";
import { getSupabaseClient } from "@/lib/supabase";

/**
 * 屋主專屬連結：只存 token 的 SHA-256 雜湊，明碼只在產生當下回傳一次。
 * 就算 seller_access_tokens 這張表外流，也還原不出可用的連結。
 */
function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** 產生新連結：先撤銷這個案件現有的有效連結，再發一組新的，同一時間只有一條連結有效。 */
export async function issueSellerToken(sellerId: string): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法產生連結。");

  await supabase
    .from("seller_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("seller_id", sellerId)
    .is("revoked_at", null);

  const token = crypto.randomBytes(32).toString("base64url");
  const { error } = await supabase
    .from("seller_access_tokens")
    .insert({ seller_id: sellerId, token_hash: hashToken(token) });
  if (error) throw error;

  return token;
}

export async function revokeSellerTokens(sellerId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法撤銷連結。");

  const { error } = await supabase
    .from("seller_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("seller_id", sellerId)
    .is("revoked_at", null);
  if (error) throw error;
}

export async function hasActiveSellerToken(sellerId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("seller_access_tokens")
    .select("id")
    .eq("seller_id", sellerId)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** 用明碼 token 查對應的 seller_id；找不到或已撤銷回傳 null。 */
export async function resolveSellerIdByToken(token: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("seller_access_tokens")
    .select("seller_id")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as { seller_id: string }).seller_id : null;
}
