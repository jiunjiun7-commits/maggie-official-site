import type { EventType } from "@/lib/events-store";

export type TrackEventType = EventType;

/**
 * 送出點擊事件，絕對不能影響原本的點擊行為（導頁、開新分頁、撥號都要正常發生）。
 * 用 sendBeacon：瀏覽器保證這個請求不會被離開頁面／導頁中斷，且完全不阻塞呼叫端。
 * 找不到 sendBeacon（極少數環境）才退回 fetch keepalive。
 */
export function trackClick(eventType: TrackEventType) {
  try {
    const body = JSON.stringify({ eventType });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const sent = navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      if (sent) return;
    }
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true
    }).catch(() => {});
  } catch {
    // 追蹤失敗絕對不能影響使用者的點擊
  }
}
