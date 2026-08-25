"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin/appointments", label: "預約管理", icon: "📅" },
  { href: "/admin/sellers", label: "屋主案件", icon: "🏠" },
  { href: "/admin/ig-growth", label: "IG 10K", icon: "📈" },
  { href: "/admin/stats", label: "數據", icon: "📊" },
  // 房市雷達／總覽用 exact 比對，避免 /admin/market-radar/transactions 等子頁被 startsWith
  // 誤判成兩個項目同時 active（子頁各自的入口都在頁面內的標題連結，不需要 Sidebar 額外標記）。
  { href: "/admin/market-radar", label: "房市雷達／總覽", icon: "📡", exact: true },
  { href: "/admin/market-radar/transactions", label: "成交資料庫", icon: "🗂️" }
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar">
      <Link className="admin-sidebar__brand" href="/admin/appointments">
        <span className="admin-sidebar__mark">M</span>
        <span className="admin-sidebar__brand-text">後台管理</span>
      </Link>

      <nav className="admin-sidebar__nav" aria-label="後台功能">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            className="admin-sidebar__link"
            data-active={"exact" in item && item.exact ? pathname === item.href : pathname.startsWith(item.href)}
            href={item.href}
          >
            <span aria-hidden="true" className="admin-sidebar__icon">{item.icon}</span>
            <span className="admin-sidebar__label">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="admin-sidebar__footer">
        <Link className="admin-sidebar__link" href="/">
          <span aria-hidden="true" className="admin-sidebar__icon">↩</span>
          <span className="admin-sidebar__label">回官網</span>
        </Link>
        <form action="/api/auth/logout" method="post">
          <button className="admin-sidebar__link admin-sidebar__logout" type="submit">
            <span aria-hidden="true" className="admin-sidebar__icon">⏻</span>
            <span className="admin-sidebar__label">登出</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
