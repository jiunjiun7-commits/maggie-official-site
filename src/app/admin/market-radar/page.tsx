import Sidebar from "@/app/admin/_components/Sidebar";
import { listAreas } from "@/lib/market-radar-store";
import { getOfficialTransactionOverviewStats, listOfficialTransactionsOverview } from "@/lib/official-transaction-overview-store";
import OverviewBoard from "./OverviewBoard";
import "../login/login.css";
import "./market-radar.css";

export const dynamic = "force-dynamic";

export default async function MarketRadarOverviewPage() {
  const [allAreas, stats, initial] = await Promise.all([
    listAreas(),
    getOfficialTransactionOverviewStats(),
    listOfficialTransactionsOverview({ sortBy: "created_at_desc", page: 1, pageSize: 50 })
  ]);
  // 篩選下拉只顯示啟用中的區域——目前 DB 有一筆「農十六」的舊停用重複區域（is_active=false，
  // 空 district），這是既有資料現況，這裡不動 DB，只在畫面上濾掉，避免下拉選單出現兩個
  // 「農十六」造成混淆。
  const areas = allAreas.filter((a) => a.isActive);

  return (
    <div className="admin-page">
      <Sidebar />
      <OverviewBoard areas={areas} stats={stats} initialRows={initial.rows} initialTotalCount={initial.totalCount} />
    </div>
  );
}
