"use client";

import type { EventCounts } from "@/lib/events-store";

const RANGES = [
  { key: "today", label: "今天" },
  { key: "7d", label: "過去 7 天" },
  { key: "30d", label: "過去 30 天" }
];

export default function StatsBoard({
  range,
  visits,
  events,
  completed
}: {
  range: string;
  visits: number | null;
  events: EventCounts | null;
  completed: number;
}) {
  const bookingClicks = events
    ? events.book_nav + events.book_hero + events.book_panel + events.book_footer + events.book_fab
    : null;
  const completionRate =
    bookingClicks && bookingClicks > 0 ? Math.round((completed / bookingClicks) * 1000) / 10 : null;

  return (
    <main className="admin-shell">
      <div className="admin-heading">
        <div>
          <h1>網站數據</h1>
          <p>行銷輔助數字，不是關鍵功能——沒接資料庫或還沒有資料時會顯示「尚無資料」。</p>
        </div>
      </div>

      <div className="filter-row" aria-label="時間範圍篩選">
        {RANGES.map((r) => (
          <a data-active={range === r.key} href={`/admin/stats?range=${r.key}`} key={r.key}>
            {r.label}
          </a>
        ))}
      </div>

      {!events || visits === null ? (
        <div className="empty-state">尚未接上資料庫，或目前沒有資料。</div>
      ) : (
        <>
          <div className="stat-grid">
            <Stat label="網站訪客數" value={visits} />
            <Stat label="預約總點擊" value={bookingClicks ?? 0} />
            <Stat label="預約完成數" value={completed} />
            <Stat label="預約完成率" value={completionRate === null ? "—" : `${completionRate}%`} />
          </div>
          <div className="stat-grid">
            <Stat label="導覽列預約點擊" value={events.book_nav} />
            <Stat label="Hero 預約點擊" value={events.book_hero} />
            <Stat label="預約區塊點擊" value={events.book_panel} />
            <Stat label="頁尾預約點擊" value={events.book_footer} />
            <Stat label="手機浮動列點擊" value={events.book_fab} />
          </div>
          <div className="stat-grid">
            <Stat label="LINE 點擊" value={events.line_click} />
            <Stat label="電話點擊" value={events.tel_click} />
            <Stat label="Instagram 點擊" value={events.instagram_click} />
            <Stat label="Facebook 點擊" value={events.facebook_click} />
          </div>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
