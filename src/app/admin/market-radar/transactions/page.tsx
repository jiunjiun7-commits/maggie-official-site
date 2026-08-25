import Sidebar from "@/app/admin/_components/Sidebar";
import { listAreas } from "@/lib/market-radar-store";
import { getOfficialTransactionOverviewStats, listOfficialTransactionsOverview, type OfficialTransactionOverviewFilters } from "@/lib/official-transaction-overview-store";
import OverviewBoard from "../OverviewBoard";
import "../../login/login.css";
import "../market-radar.css";

export const dynamic = "force-dynamic";

/**
 * Phase 11｜成交資料庫（原本 /admin/market-radar 的完整成交大表，搬到這裡獨立成頁面，
 * 邏輯完全沿用 OverviewBoard.tsx，不重寫）。
 *
 * 支援從情報作戰中心帶入初始篩選條件（區域卡／待處理／快速查行情連過來時），例如：
 * ?areaId=xxx、?matchStatus=needs_confirmation、?keyword=帝品苑。
 */
export default async function MarketRadarTransactionsPage({
  searchParams
}: {
  searchParams: Promise<{ areaId?: string; matchStatus?: string; communitySearch?: string; addressSearch?: string; keyword?: string; sortBy?: string }>;
}) {
  const params = await searchParams;

  const filters: OfficialTransactionOverviewFilters = {
    areaId: params.areaId || undefined,
    matchStatus: (params.matchStatus as OfficialTransactionOverviewFilters["matchStatus"]) || undefined,
    communitySearch: params.communitySearch || undefined,
    addressSearch: params.addressSearch || undefined,
    keyword: params.keyword || undefined,
    sortBy: (params.sortBy as OfficialTransactionOverviewFilters["sortBy"]) || (params.keyword ? "transaction_date_desc" : "created_at_desc"),
    page: 1,
    pageSize: 50
  };

  const [allAreas, stats, initial] = await Promise.all([listAreas(), getOfficialTransactionOverviewStats(), listOfficialTransactionsOverview(filters)]);
  const areas = allAreas.filter((a) => a.isActive);

  return (
    <div className="admin-page">
      <Sidebar />
      <OverviewBoard
        areas={areas}
        stats={stats}
        initialRows={initial.rows}
        initialTotalCount={initial.totalCount}
        initialFilters={{
          areaId: params.areaId,
          matchStatus: params.matchStatus,
          // keyword 帶進來的初始查詢已經反映在 initialRows 裡，但 OverviewBoard 表單本身沒有
          // 「keyword」欄位（它是社區/地址分開的兩個欄位），所以這裡不塞進 communitySearch/
          // addressSearch，避免使用者看到表單裡有值卻跟網址上的 keyword 語意對不起來——
          // 表單維持空白，使用者可以直接用自己習慣的社區/地址欄位再篩一次。
          communitySearch: params.keyword ? undefined : params.communitySearch,
          addressSearch: params.keyword ? undefined : params.addressSearch,
          sortBy: filters.sortBy
        }}
      />
    </div>
  );
}
