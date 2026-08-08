import { getSupabaseClient } from "@/lib/supabase";

export const EVENT_TYPES = [
  "book_nav",
  "book_hero",
  "book_panel",
  "book_footer",
  "book_fab",
  "line_click",
  "tel_click",
  "instagram_click",
  "facebook_click"
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type EventCounts = Record<EventType, number>;

export function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

/**
 * 記一筆點擊事件。跟 visit-counter.ts 一樣，這只是行銷輔助數字，
 * 沒接資料庫或寫入失敗都安靜吞掉，絕對不能讓追蹤拖垮點擊本身的導頁行為。
 */
export async function recordEvent(eventType: EventType): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    await supabase.from("events").insert({ event_type: eventType });
  } catch {
    // 安靜放棄
  }
}

/**
 * 依日期範圍統計各事件類型的次數。一次查詢撈出範圍內所有列的
 * event_type 欄位，在記憶體裡分類加總，不用對 9 種事件各發一次查詢。
 * 沒接資料庫或查詢失敗時回傳 null，呼叫端（stats 頁）要能顯示「尚無資料」。
 */
export async function getEventCounts(range: { start: string; end: string }): Promise<EventCounts | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("events")
      .select("event_type")
      .gte("created_at", range.start)
      .lt("created_at", range.end);
    if (error) throw error;

    const counts = Object.fromEntries(EVENT_TYPES.map((type) => [type, 0])) as EventCounts;
    for (const row of data as { event_type: EventType }[]) {
      counts[row.event_type] += 1;
    }
    return counts;
  } catch {
    return null;
  }
}
