import { getSupabaseClient } from "@/lib/supabase";

export type VisitStats = { total: number; today: number };
export type StatsRange = "today" | "7d" | "30d";

/**
 * 把「今天／過去 7 天／過去 30 天」換算成台北時區（固定 UTC+8，沒有日光節約時間）
 * 的日期起訖 ISO 字串。「過去 N 天」包含今天在內，所以 7 天回推 6 天、30 天回推 29 天。
 */
export function statsRangeTaipei(range: StatsRange) {
  const daysBack = range === "today" ? 0 : range === "7d" ? 6 : 29;
  const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
  const taipeiNow = new Date(Date.now() + TAIPEI_OFFSET_MS);
  const todayStartUtcMs =
    Date.UTC(taipeiNow.getUTCFullYear(), taipeiNow.getUTCMonth(), taipeiNow.getUTCDate()) -
    TAIPEI_OFFSET_MS;
  const startUtcMs = todayStartUtcMs - daysBack * 24 * 60 * 60 * 1000;
  return {
    start: new Date(startUtcMs).toISOString(),
    end: new Date(todayStartUtcMs + 24 * 60 * 60 * 1000).toISOString()
  };
}

function todayRangeTaipei() {
  return statsRangeTaipei("today");
}

/**
 * 給 /admin/stats 用的日期區間訪客數，跟頁尾的 recordVisitAndGetStats() 分開，
 * 這個只讀不寫，不會多記一筆造訪。
 */
export async function visitCountInRange(range: { start: string; end: string }): Promise<number | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { count, error } = await supabase
      .from("page_views")
      .select("*", { count: "exact", head: true })
      .gte("viewed_at", range.start)
      .lt("viewed_at", range.end);
    if (error) throw error;
    return count ?? 0;
  } catch {
    return null;
  }
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
