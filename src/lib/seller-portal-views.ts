import { getSupabaseClient } from "@/lib/supabase";

/**
 * 屋主開啟專屬連結的紀錄，用來在後台顯示「這份週報屋主開過了沒」。
 *
 * 刻意只記「什麼時候被開啟」，不記 IP、不記瀏覽器、不記看了哪些區塊——
 * 這是判斷「要不要提醒屋主看週報」用的，不需要也不應該蒐集更多。
 */

/** 同一位屋主連續重整不重複記錄，避免一次開啟被算成十次。 */
const DEDUPE_MINUTES = 30;

export async function recordPortalView(sellerId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const since = new Date(Date.now() - DEDUPE_MINUTES * 60_000).toISOString();
  const { data: recent } = await supabase
    .from("seller_portal_views")
    .select("id")
    .eq("seller_id", sellerId)
    .gte("viewed_at", since)
    .limit(1);
  if (recent && recent.length) return;

  // 記錄失敗不該影響屋主看週報，所以這裡不丟例外。
  await supabase.from("seller_portal_views").insert({ seller_id: sellerId });
}

/** 這個案件所有的開啟時間（新的在前）。資料量很小，不分頁。 */
export async function listPortalViews(sellerId: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("seller_portal_views")
    .select("viewed_at")
    .eq("seller_id", sellerId)
    .order("viewed_at", { ascending: false });
  if (error) return [];
  return (data as { viewed_at: string }[]).map((r) => r.viewed_at);
}

/**
 * 這份週報發布之後，屋主有沒有開過連結。
 *
 * 只能證明「他在這之後開啟過專屬連結」，不能證明他真的把這份週報讀完——
 * 所以後台的文案用「已開啟」而不是「已讀」，不要給出比實際更強的保證。
 */
export function openedAfter(views: string[], reportCreatedAt: string): string | null {
  const hit = views.find((v) => v > reportCreatedAt);
  return hit ?? null;
}
