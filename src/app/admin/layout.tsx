import type { Metadata } from "next";

/**
 * 後台一律不給搜尋引擎索引——內容需要登入才看得到，被爬到也只會看到登入頁，
 * 但明確關掉還是比較乾淨，不要讓 /admin/* 出現在搜尋結果或站外連結預覽。
 * 覆蓋掉根 layout 的 robots: { index: true, follow: true }。
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
