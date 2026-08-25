import Sidebar from "@/app/admin/_components/Sidebar";
import { getAreaDashboardStats, getLatestSyncStatus, getMonitoredAreas, getOfficialTransactionOverviewStats, listOfficialTransactionsOverview } from "@/lib/official-transaction-overview-store";
import Dashboard from "./Dashboard";
import "../login/login.css";
import "./market-radar.css";

export const dynamic = "force-dynamic";

/**
 * Phase 11｜高雄房市情報雷達｜情報作戰中心（首頁）。
 *
 * 定位：「30 秒內知道發生什麼事」，不是完整成交大表——大表已經搬到 /admin/market-radar/transactions
 * （OverviewBoard.tsx，邏輯完全沒動）。這裡只組裝儀表板需要的彙總資料。
 */
export default async function MarketRadarDashboardPage() {
  const areas = await getMonitoredAreas();

  const [latestSync, stats, areaStats, latestTransactions] = await Promise.all([
    getLatestSyncStatus(),
    getOfficialTransactionOverviewStats(),
    getAreaDashboardStats(areas.map((a) => ({ id: a.id, name: a.name }))),
    listOfficialTransactionsOverview({ sortBy: "created_at_desc", page: 1, pageSize: 10 })
  ]);

  return (
    <div className="admin-page">
      <Sidebar />
      <Dashboard latestSync={latestSync} stats={stats} areaStats={areaStats} latestTransactions={latestTransactions.rows} />
    </div>
  );
}
