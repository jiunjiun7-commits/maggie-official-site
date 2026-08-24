"use client";

import Link from "next/link";
import { useState } from "react";
import type { MarketRadarArea } from "@/lib/market-radar-store";
import type {
  OfficialTransactionMatchStatus,
  OfficialTransactionOverviewRow,
  OfficialTransactionOverviewStats
} from "@/lib/official-transaction-overview-store";
import { formatTotalPriceInWan, formatUnitPriceInWan } from "@/lib/line-messaging";

const MATCH_STATUS_LABEL: Record<OfficialTransactionMatchStatus, string> = {
  auto_matched: "已配對社區",
  confirmed: "已確認社區",
  needs_confirmation: "待確認社區",
  no_community: "無社區（透天）",
  not_matched: "尚未比對"
};

const MATCH_STATUS_FALLBACK_LABEL: Record<OfficialTransactionMatchStatus, string> = {
  auto_matched: "（未知社區）",
  confirmed: "（未知社區）",
  needs_confirmation: "待確認社區",
  no_community: "無社區",
  not_matched: "尚未比對"
};

function formatBuildingArea(value: number | null): string {
  if (value === null) return "—";
  return `${value.toLocaleString("zh-TW")} 坪`;
}

function formatFloor(row: OfficialTransactionOverviewRow): string {
  if (row.floorNumber !== null && row.totalFloors !== null) return `${row.floorNumber}/${row.totalFloors}`;
  return row.floorRaw || "—";
}

/**
 * 房/廳/衛全部缺值，或官方原始資料三個都是 0（代表這筆本來就不是「有房間隔間」的一般住宅格局，
 * 例如車位、大面積商用空間整棟交易），都不算「有格局資料」，顯示 —，不要顯示 0房0廳0衛。
 */
function formatLayout(row: OfficialTransactionOverviewRow): string {
  const { roomCount, hallCount, bathCount } = row;
  if (roomCount === null || hallCount === null || bathCount === null) return "—";
  if (roomCount === 0 && hallCount === 0 && bathCount === 0) return "—";
  return `${roomCount}房${hallCount}廳${bathCount}衛`;
}

const PAGE_SIZE = 50;

export default function OverviewBoard({
  areas,
  stats,
  initialRows,
  initialTotalCount
}: {
  areas: MarketRadarArea[];
  stats: OfficialTransactionOverviewStats;
  initialRows: OfficialTransactionOverviewRow[];
  initialTotalCount: number;
}) {
  const [rows, setRows] = useState(initialRows);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const [areaId, setAreaId] = useState("");
  const [matchStatus, setMatchStatus] = useState("");
  const [communitySearch, setCommunitySearch] = useState("");
  const [addressSearch, setAddressSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("created_at_desc");

  async function runQuery(targetPage: number) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (areaId) params.set("areaId", areaId);
      if (matchStatus) params.set("matchStatus", matchStatus);
      if (communitySearch.trim()) params.set("communitySearch", communitySearch.trim());
      if (addressSearch.trim()) params.set("addressSearch", addressSearch.trim());
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("sortBy", sortBy);
      params.set("page", String(targetPage));
      params.set("pageSize", String(PAGE_SIZE));

      const response = await fetch(`/api/market-radar/official-transactions?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "查詢失敗");
      setRows(payload.rows);
      setTotalCount(payload.totalCount);
      setPage(targetPage);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "查詢失敗");
    } finally {
      setLoading(false);
    }
  }

  function submitFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runQuery(1);
  }

  function resetFilters() {
    setAreaId("");
    setMatchStatus("");
    setCommunitySearch("");
    setAddressSearch("");
    setDateFrom("");
    setDateTo("");
    setSortBy("created_at_desc");
    setRows(initialRows);
    setTotalCount(initialTotalCount);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <main className="admin-shell">
      <div className="admin-heading">
        <div>
          <h1>房市情報雷達總覽</h1>
          <p>目前監控區域內、命中官方實價登錄的成交資料，社區配對狀態沿用 Community Matching 既有規則，不猜測。</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link className="button-secondary" href="/admin/market-radar/areas">
            區域管理
          </Link>
          <Link className="button-secondary" href="/admin/market-radar/communities">
            社區資料庫
          </Link>
          <Link className="button-secondary" href="/admin/market-radar/notifications">
            通知中心
          </Link>
        </div>
      </div>

      <div className="radar-grid" style={{ marginBottom: 20 }}>
        <div className="radar-card" data-active="true">
          <div className="radar-card-top">
            <strong>{stats.totalCount.toLocaleString("zh-TW")}</strong>
          </div>
          <div className="radar-card-row">全部成交筆數（監控區域內）</div>
        </div>
        <div className="radar-card" data-active="true">
          <div className="radar-card-top">
            <strong>{stats.todayNewCount.toLocaleString("zh-TW")}</strong>
          </div>
          <div className="radar-card-row">今日新增（系統新增日期）</div>
        </div>
        <div className="radar-card" data-active="true">
          <div className="radar-card-top">
            <strong>{stats.last7DaysNewCount.toLocaleString("zh-TW")}</strong>
          </div>
          <div className="radar-card-row">最近 7 天新增（系統新增日期）</div>
        </div>
        <div className="radar-card" data-active="true">
          <div className="radar-card-top">
            <strong>{stats.last30DaysNewCount.toLocaleString("zh-TW")}</strong>
          </div>
          <div className="radar-card-row">最近 30 天新增（系統新增日期）</div>
        </div>
        <div className="radar-card" data-active="true">
          <div className="radar-card-top">
            <strong>{stats.needsConfirmationCount.toLocaleString("zh-TW")}</strong>
          </div>
          <div className="radar-card-row">待確認社區筆數</div>
        </div>
      </div>

      <div className="radar-panel">
        <form className="radar-form" onSubmit={submitFilters}>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="areaId">區域</label>
              <select id="areaId" onChange={(e) => setAreaId(e.target.value)} value={areaId}>
                <option value="">全部</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="matchStatus">社區配對狀態</label>
              <select id="matchStatus" onChange={(e) => setMatchStatus(e.target.value)} value={matchStatus}>
                <option value="">全部</option>
                {(Object.keys(MATCH_STATUS_LABEL) as OfficialTransactionMatchStatus[]).map((key) => (
                  <option key={key} value={key}>
                    {MATCH_STATUS_LABEL[key]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="communitySearch">社區名稱搜尋</label>
              <input id="communitySearch" onChange={(e) => setCommunitySearch(e.target.value)} placeholder="例如：京城" value={communitySearch} />
            </div>
            <div className="field">
              <label htmlFor="addressSearch">地址搜尋</label>
              <input id="addressSearch" onChange={(e) => setAddressSearch(e.target.value)} placeholder="例如：龍勝路" value={addressSearch} />
            </div>
            <div className="field">
              <label htmlFor="dateFrom">交易日期（起）</label>
              <input id="dateFrom" onChange={(e) => setDateFrom(e.target.value)} type="date" value={dateFrom} />
            </div>
            <div className="field">
              <label htmlFor="dateTo">交易日期（迄）</label>
              <input id="dateTo" onChange={(e) => setDateTo(e.target.value)} type="date" value={dateTo} />
            </div>
            <div className="field">
              <label htmlFor="sortBy">排序</label>
              <select id="sortBy" onChange={(e) => setSortBy(e.target.value)} value={sortBy}>
                <option value="created_at_desc">系統最新新增</option>
                <option value="transaction_date_desc">交易日期 新→舊</option>
                <option value="unit_price_desc">單價 高→低</option>
                <option value="total_price_desc">總價 高→低</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button className="button" disabled={loading} type="submit">
              {loading ? "查詢中..." : "套用篩選"}
            </button>
            <button className="button-secondary" disabled={loading} onClick={resetFilters} type="button">
              清除篩選
            </button>
          </div>
          {error ? <div className="form-error">{error}</div> : null}
        </form>
      </div>

      <div className="radar-panel">
        <p style={{ color: "#9fb0c7", fontSize: 13, marginTop: -6, marginBottom: 12 }}>
          共 {totalCount.toLocaleString("zh-TW")} 筆，第 {page} / {totalPages} 頁。
        </p>

        {rows.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="radar-table">
              <thead>
                <tr>
                  <th>社區</th>
                  <th>地址</th>
                  <th>交易日期</th>
                  <th>總價</th>
                  <th>單價</th>
                  <th>建物坪數</th>
                  <th>格局（房/廳/衛）</th>
                  <th>樓層/總樓層</th>
                  <th>命中區域</th>
                  <th>配對狀態</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.communityName ?? MATCH_STATUS_FALLBACK_LABEL[row.matchStatus]}</td>
                    <td>{row.address}</td>
                    <td>{row.transactionDate ?? "—"}</td>
                    <td>{formatTotalPriceInWan(row.totalPrice)}</td>
                    <td>{formatUnitPriceInWan(row.unitPrice)}</td>
                    <td>{formatBuildingArea(row.buildingAreaPing)}</td>
                    <td>{formatLayout(row)}</td>
                    <td>{formatFloor(row)}</td>
                    <td>
                      {row.matchedAreaNames.map((name) => (
                        <span className="tag active-true" key={name} style={{ marginRight: 6 }}>
                          {name}
                        </span>
                      ))}
                    </td>
                    <td style={{ fontSize: 12, color: "#9fb0c7" }}>{MATCH_STATUS_LABEL[row.matchStatus]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">目前沒有符合篩選條件的成交資料。</div>
        )}

        {totalPages > 1 ? (
          <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
            <button className="button-secondary" disabled={loading || page <= 1} onClick={() => runQuery(page - 1)} type="button">
              上一頁
            </button>
            <span style={{ color: "#9fb0c7", fontSize: 13 }}>
              第 {page} / {totalPages} 頁
            </span>
            <button className="button-secondary" disabled={loading || page >= totalPages} onClick={() => runQuery(page + 1)} type="button">
              下一頁
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
