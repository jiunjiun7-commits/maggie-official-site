import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 只能在伺服器端使用（API route）。
 *
 * 刻意不用 NEXT_PUBLIC_ 開頭的環境變數名稱——Next.js 只會把
 * NEXT_PUBLIC_* 打包進瀏覽器端的程式碼，用一般名稱可以確保
 * service_role 金鑰不會被意外送到客戶端。
 *
 * 沒有設定這兩個環境變數時回傳 null，appointment-store.ts
 * 會自動退回本機檔案模式，本機開發不需要額外設定。
 */
export function readSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

let cached: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const config = readSupabaseConfig();
  if (!config) return null;
  if (!cached) {
    cached = createClient(config.url, config.serviceRoleKey, {
      auth: { persistSession: false }
    });
  }
  return cached;
}
