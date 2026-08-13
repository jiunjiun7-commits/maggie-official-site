import Topbar from "@/app/_components/Topbar";
import { listSellers } from "@/lib/seller-store";
import { getLatestSellerReport } from "@/lib/seller-report-store";
import SellersBoard, { type SellerCardRow } from "./SellersBoard";
import "../login/login.css";
import "./sellers.css";

export const dynamic = "force-dynamic";

export default async function SellersPage() {
  const sellers = await listSellers();
  const rows: SellerCardRow[] = await Promise.all(
    sellers.map(async (seller) => ({
      seller,
      latestReportDate: (await getLatestSellerReport(seller.id))?.reportDate ?? null
    }))
  );
  const districts = Array.from(new Set(sellers.map((s) => s.district).filter(Boolean))).sort();

  return (
    <div className="admin-page">
      <Topbar admin />
      <form action="/api/auth/logout" method="post" style={{ padding: "12px 24px 0", textAlign: "right" }}>
        <button className="admin-logout" type="submit">登出</button>
      </form>
      <SellersBoard districts={districts} initialRows={rows} />
    </div>
  );
}
