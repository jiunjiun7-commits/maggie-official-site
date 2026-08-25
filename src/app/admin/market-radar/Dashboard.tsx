"use client";

import Link from "next/link";
import { useState } from "react";
import type { AreaDashboardStat, LatestSyncStatus, OfficialTransactionOverviewRow, OfficialTransactionOverviewStats } from "@/lib/official-transaction-overview-store";
import { formatTotalPriceInWan, formatUnitPriceInWan } from "@/lib/line-messaging";
import { formatBuildingArea, formatFloor, formatLayout } from "@/lib/market-radar-display";

const SYNC_STATUS_LABEL: Record<string, string> = {
  success: "正常",
  partial: "部分完成",
  failed: "失敗"
};

function formatSyncTime(iso: string | null): string {
  if (!iso) return "尚未執行過";
  const d = new Date(iso);
  const taipei = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const mm = String(taipei.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(taipei.getUTCDate()).padStart(2, "0");
  const hh = String(taipei.getUTCHours()).padStart(2, "0");
  const min = String(taipei.getUTCMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

/** 顯示用日期格式（2026-03-31 → 2026/03/31），純顯示轉換，不動原始資料。 */
function formatDisplayDate(value: string | null): string | null {
  if (!value) return null;
  return value.replaceAll("-", "/");
}

function CommunityOrAddress({ communityName, address }: { communityName: string | null; address: string }) {
  return <>{communityName ?? address}</>;
}

/** 情報卡共用的「格局｜坪數｜樓層」精簡資訊列，缺值的欄位直接不出現，不硬湊。 */
function CompactFacts({ row }: { row: { roomCount: number | null; hallCount: number | null; bathCount: number | null; buildingAreaPing: number | null; floorNumber: number | null; totalFloors: number | null; floorRaw?: string } }) {
  const layout = formatLayout(row);
  const area = formatBuildingArea(row.buildingAreaPing);
  const floor = formatFloor(row);
  const parts = [layout !== "—" ? layout : null, area !== "—" ? area : null, floor !== "—" ? floor : null].filter((p): p is string => p !== null);
  if (parts.length === 0) return null;
  return <div className="rd-facts">{parts.join("　")}</div>;
}

function TransactionCard({ row, compact }: { row: OfficialTransactionOverviewRow; compact?: boolean }) {
  return (
    <div className={compact ? "rd-txn rd-txn--compact" : "rd-txn"}>
      <div className="rd-txn-headline">
        <span className="rd-txn-name">
          <CommunityOrAddress address={row.address} communityName={row.communityName} />
        </span>
        <div className="rd-txn-tags">
          {row.matchedAreaNames.map((name) => (
            <span className="rd-tag" key={name}>
              {name}
            </span>
          ))}
        </div>
      </div>
      <div className="rd-txn-meta">{formatDisplayDate(row.transactionDate) ?? "—"}</div>
      <div className="rd-txn-price">
        <span className="rd-txn-price-total">{formatTotalPriceInWan(row.totalPrice)}</span>
        {row.unitPrice !== null ? (
          <>
            <span className="rd-txn-price-sep">｜</span>
            <span className="rd-txn-price-unit">{formatUnitPriceInWan(row.unitPrice)}</span>
          </>
        ) : null}
      </div>
      <CompactFacts row={row} />
      {!compact ? <div className="rd-txn-address">{row.address}</div> : null}
    </div>
  );
}

export default function Dashboard({
  latestSync,
  stats,
  areaStats,
  latestTransactions
}: {
  latestSync: LatestSyncStatus;
  stats: OfficialTransactionOverviewStats;
  areaStats: AreaDashboardStat[];
  latestTransactions: OfficialTransactionOverviewRow[];
}) {
  const [keyword, setKeyword] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState<OfficialTransactionOverviewRow[] | null>(null);

  async function runSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = keyword.trim();
    if (!term) {
      setSearchResults(null);
      setSearchError("");
      return;
    }
    setSearchLoading(true);
    setSearchError("");
    try {
      const params = new URLSearchParams({ keyword: term, sortBy: "transaction_date_desc", pageSize: "8" });
      const response = await fetch(`/api/market-radar/official-transactions?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "查詢失敗");
      setSearchResults(payload.rows);
    } catch (caught) {
      setSearchError(caught instanceof Error ? caught.message : "查詢失敗");
    } finally {
      setSearchLoading(false);
    }
  }

  const todayAreas = areaStats.filter((a) => a.todayNewCount > 0);
  // bar 寬度以「四區裡的最大值」為 100%，純顯示用的相對寬度，不是新指標。
  const maxTotal = Math.max(1, ...areaStats.map((a) => a.totalCount));

  return (
    <main className="rd-shell">
      {/* ---------- 1. Radar Status（壓縮高度的狀態列） ---------- */}
      <div className="rd-status">
        <div className="rd-status-main">
          <span className="rd-status-eyebrow">高雄房市情報雷達</span>
          {stats.todayNewCount === 0 ? (
            <span className="rd-status-today rd-status-today--zero">今日尚無新成交</span>
          ) : (
            <span className="rd-status-today">
              今日新增 <strong>{stats.todayNewCount}</strong> 筆
              {todayAreas.length > 0 ? (
                <span className="rd-status-today-areas">
                  {todayAreas.map((a) => (
                    <Link className="rd-status-chip" href={`/admin/market-radar/transactions?areaId=${a.areaId}`} key={a.areaId}>
                      {a.areaName} +{a.todayNewCount}
                    </Link>
                  ))}
                </span>
              ) : null}
            </span>
          )}
        </div>
        <div className="rd-status-side">
          <span className={`rd-sync-dot rd-sync-dot--${latestSync.status ?? "unknown"}`} />
          <span>
            {latestSync.status ? SYNC_STATUS_LABEL[latestSync.status] ?? latestSync.status : "—"}．最後同步 {formatSyncTime(latestSync.finishedAt)}
          </span>
          <Link className="rd-link" href="/admin/market-radar/transactions">
            成交資料庫 →
          </Link>
        </div>
      </div>

      {/* ---------- 2. 四區行情比較：首頁主要視覺 ---------- */}
      <div className="rd-compare">
        <div className="rd-section-head">
          <h2>四大監控區域比較</h2>
          <span className="rd-section-hint">累積成交筆數（監控範圍內）</span>
        </div>
        <div className="rd-compare-bars">
          {areaStats.map((a) => (
            <Link className="rd-compare-row" href={`/admin/market-radar/transactions?areaId=${a.areaId}`} key={a.areaId}>
              <span className="rd-compare-name">{a.areaName}</span>
              <span className="rd-compare-bar-track">
                <span className="rd-compare-bar-fill" style={{ width: `${(a.totalCount / maxTotal) * 100}%` }} />
              </span>
              <span className="rd-compare-count">{a.totalCount}</span>
              <span className="rd-compare-delta">{a.last7DaysNewCount > 0 ? `近7天 +${a.last7DaysNewCount}` : "近7天持平"}</span>
            </Link>
          ))}
        </div>
        <div className="rd-compare-snapshots">
          {areaStats.map((a) => (
            <div className="rd-snapshot" key={a.areaId}>
              <div className="rd-snapshot-name">{a.areaName}</div>
              {a.latestTransaction ? (
                <>
                  <div className="rd-snapshot-latest-name">
                    <CommunityOrAddress address={a.latestTransaction.address} communityName={a.latestTransaction.communityName} />
                  </div>
                  <div className="rd-snapshot-latest-price">
                    {a.latestTransaction.unitPrice !== null ? formatUnitPriceInWan(a.latestTransaction.unitPrice) : formatTotalPriceInWan(a.latestTransaction.totalPrice)}
                  </div>
                </>
              ) : (
                <div className="rd-snapshot-empty">目前還沒有一般住宅成交資料</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ---------- 3. 最新成交（首頁只放最近 5 筆） × 需要我處理 ---------- */}
      <div className="rd-columns">
        <div className="rd-col-main">
          <div className="rd-section-head">
            <h2>最新成交</h2>
            <Link className="rd-link" href="/admin/market-radar/transactions">
              查看全部 →
            </Link>
          </div>
          {latestTransactions.length ? (
            <div className="rd-txn-list">
              {latestTransactions.slice(0, 5).map((row) => (
                <TransactionCard key={row.id} row={row} />
              ))}
            </div>
          ) : (
            <div className="rd-empty">目前監控區域內還沒有成交資料。</div>
          )}
        </div>

        <div className="rd-col-side">
          <Link className="rd-attention" href="/admin/market-radar/transactions?matchStatus=needs_confirmation">
            <div className="rd-attention-head">
              <span className="rd-attention-icon">◆</span>
              <span>需要我處理</span>
            </div>
            <div className="rd-attention-count">{stats.needsConfirmationCount}</div>
            <div className="rd-attention-label">筆待確認社區配對</div>
            <div className="rd-attention-cta">前往處理 →</div>
          </Link>
        </div>
      </div>

      {/* ---------- 4. 快速查行情：獨立工具區 ---------- */}
      <div className="rd-tool">
        <div className="rd-section-head">
          <h2>快速查行情</h2>
          <span className="rd-section-hint">接到電話時直接查</span>
        </div>
        <form className="rd-tool-form" onSubmit={runSearch}>
          <input
            aria-label="搜尋社區、路名或地址"
            className="rd-tool-input"
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜尋社區、路名或地址，例如：帝品苑、美術東四路、龍勝路"
            value={keyword}
          />
          <button className="rd-tool-button" disabled={searchLoading} type="submit">
            {searchLoading ? "搜尋中..." : "搜尋"}
          </button>
        </form>
        {searchError ? <div className="form-error">{searchError}</div> : null}
        {searchResults !== null ? (
          searchResults.length ? (
            <div className="rd-tool-results">
              {searchResults.map((row) => (
                <TransactionCard compact key={row.id} row={row} />
              ))}
              <Link className="rd-link" href={`/admin/market-radar/transactions?keyword=${encodeURIComponent(keyword.trim())}`}>
                在成交資料庫查看完整結果 →
              </Link>
            </div>
          ) : (
            <div className="rd-empty">沒有找到符合「{keyword.trim()}」的成交資料。</div>
          )
        ) : null}
      </div>
    </main>
  );
}
