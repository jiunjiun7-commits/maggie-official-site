import { NextResponse } from "next/server";
import {
  listOfficialTransactionsOverview,
  type OfficialTransactionMatchStatus,
  type OfficialTransactionOverviewFilters
} from "@/lib/official-transaction-overview-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_MATCH_STATUS: OfficialTransactionMatchStatus[] = ["auto_matched", "needs_confirmation", "confirmed", "no_community", "not_matched"];
const VALID_SORT: NonNullable<OfficialTransactionOverviewFilters["sortBy"]>[] = [
  "created_at_desc",
  "transaction_date_desc",
  "unit_price_desc",
  "total_price_desc"
];

/** 房市情報雷達總覽的成交列表查詢，唯讀，供後台篩選/排序/分頁互動使用。 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const matchStatusParam = searchParams.get("matchStatus");
  const sortByParam = searchParams.get("sortBy");

  const filters: OfficialTransactionOverviewFilters = {
    areaId: searchParams.get("areaId") || undefined,
    matchStatus: matchStatusParam && VALID_MATCH_STATUS.includes(matchStatusParam as OfficialTransactionMatchStatus) ? (matchStatusParam as OfficialTransactionMatchStatus) : undefined,
    communitySearch: searchParams.get("communitySearch") || undefined,
    addressSearch: searchParams.get("addressSearch") || undefined,
    keyword: searchParams.get("keyword") || undefined,
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
    sortBy:
      sortByParam && (VALID_SORT as string[]).includes(sortByParam)
        ? (sortByParam as NonNullable<OfficialTransactionOverviewFilters["sortBy"]>)
        : undefined,
    page: Number(searchParams.get("page")) || 1,
    pageSize: Number(searchParams.get("pageSize")) || 50
  };

  try {
    const result = await listOfficialTransactionsOverview(filters);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "查詢失敗" }, { status: 500 });
  }
}
