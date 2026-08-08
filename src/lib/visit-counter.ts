import { getSupabaseClient } from "@/lib/supabase";

export type VisitStats = { total: number; today: number };

/** 台灣沒有日光節約時間，固定 UTC+8，直接用毫秒位移換算「今天」的起訖時間即可。 */
function todayRangeTaipei() {
  const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
  const taipeiNow = new Date(Date.now() + TAIPEI_OFFSET_MS);
  const startUtcMs =
    Date.UTC(taipeiNow.getUTCFullYear(), taipeiNow.getUTCMonth(), taipeiNow.getUTCDate()) -
    TAIPEI_OFFSET_MS;
  return {
    start: new Date(startUtcMs).toISOString(),
    end: new Date(startUtcMs + 24 * 60 * 60 * 1000).toISOString()
  };
}

/**
 * 記一筆造訪，並回傳累積與今日的次數。
 * 這個數字只是給訪客看的社會證明小工具，不是關鍵功能——
 * 沒接資料庫或資料庫出狀況時安靜回傳 null，讓頁尾不顯示這個區塊就好，
 * 不能讓它拖垮整個首頁。
 */
export async function recordVisitAndGetStats(): Promise<VisitStats | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { error: insertError } = await supabase.from("page_views").insert({});
    if (insertError) throw insertError;

    const { count: total, error: totalError } = await supabase
      .from("page_views")
      .select("*", { count: "exact", head: true });
    if (totalError) throw totalError;

    const { start, end } = todayRangeTaipei();
    const { count: today, error: todayError } = await supabase
      .from("page_views")
      .select("*", { count: "exact", head: true })
      .gte("viewed_at", start)
      .lt("viewed_at", end);
    if (todayError) throw todayError;

    return { total: total ?? 0, today: today ?? 0 };
  } catch {
    return null;
  }
}
