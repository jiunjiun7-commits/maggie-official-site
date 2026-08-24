import Link from "next/link";
import { BRAND } from "@/lib/profile";

export default function Topbar({ admin = false }: { admin?: boolean }) {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brand-mark">M</span>
        <span>{admin ? "預約管理" : BRAND.shortName}</span>
      </Link>
      <nav className="topnav" aria-label="主要導覽">
        <Link href="/">官網</Link>
        <Link href="/card">名片</Link>
        <Link href="/card/booking">預約</Link>
        <Link href="/admin/appointments">後台</Link>
        {admin ? <Link href="/admin/sellers">屋主案件</Link> : null}
        {admin ? <Link href="/admin/market-radar/areas">房市雷達</Link> : null}
        {admin ? <Link href="/admin/market-radar/internal">內部成交</Link> : null}
        {admin ? <Link href="/admin/ig-growth">IG 10K</Link> : null}
        {admin ? <Link href="/admin/stats">數據</Link> : null}
      </nav>
    </header>
  );
}
