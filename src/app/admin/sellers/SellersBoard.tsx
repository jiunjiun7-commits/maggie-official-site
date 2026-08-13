"use client";

import { useState } from "react";
import type { Seller, SellerStatus } from "@/lib/seller-store";
import { reportFreshness, type ReportFreshness } from "@/lib/seller-report-store";

export type SellerCardRow = { seller: Seller; latestReportDate: string | null };

const STATUS_LABEL: Record<SellerStatus, string> = {
  active: "服務中",
  sold: "已成交",
  ended: "已結束"
};

const FRESHNESS_LABEL: Record<ReportFreshness, string> = {
  updated: "本週已更新",
  due: "週報待更新",
  overdue: "回報逾期",
  none: "尚無週報"
};

function formatDate(value: string) {
  return value ? value.slice(0, 10) : "—";
}

export default function SellersBoard({
  initialRows,
  districts
}: {
  initialRows: SellerCardRow[];
  districts: string[];
}) {
  const [rows] = useState(initialRows);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [districtFilter, setDistrictFilter] = useState("all");

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communityName: form.get("communityName"),
          district: form.get("district"),
          listingTitle: form.get("listingTitle"),
          ownerName: form.get("ownerName"),
          engagementStart: form.get("engagementStart"),
          engagementEnd: form.get("engagementEnd"),
          askingPrice: form.get("askingPrice"),
          address: form.get("address"),
          internalNote: form.get("internalNote")
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "建立失敗");
      window.location.href = `/admin/sellers/${payload.seller.id}`;
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "建立失敗");
      setBusy(false);
    }
  }

  const visibleRows =
    districtFilter === "all" ? rows : rows.filter(({ seller }) => seller.district === districtFilter);

  return (
    <main className="admin-shell">
      <div className="admin-heading">
        <div>
          <h1>屋主案件</h1>
          <p>目前服務中的委託案件一覽，點卡片進去管理基本資料與每週 Seller Report。</p>
        </div>
        <button className="button" onClick={() => setShowForm((v) => !v)} type="button">
          {showForm ? "取消" : "＋ 新增案件"}
        </button>
      </div>

      {showForm ? (
        <form className="seller-form" onSubmit={submitCreate}>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="district">區域</label>
              <input id="district" list="district-suggestions" name="district" placeholder="例如：前鎮區" />
              <datalist id="district-suggestions">
                {districts.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label htmlFor="communityName">社區/案名</label>
              <input id="communityName" name="communityName" placeholder="例如：中山首府" required />
            </div>
            <div className="field full">
              <label htmlFor="listingTitle">完整物件標題（選填，內部用）</label>
              <input id="listingTitle" name="listingTitle" placeholder="例如：(前鎮區中山首府)亞灣三多高樓景觀質感四房R7捷運宅" />
            </div>
            <div className="field">
              <label htmlFor="ownerName">屋主姓名</label>
              <input id="ownerName" name="ownerName" required />
            </div>
            <div className="field">
              <label htmlFor="engagementStart">委託開始日</label>
              <input id="engagementStart" name="engagementStart" type="date" required />
            </div>
            <div className="field">
              <label htmlFor="engagementEnd">委託結束日</label>
              <input id="engagementEnd" name="engagementEnd" type="date" required />
            </div>
            <div className="field">
              <label htmlFor="askingPrice">開價</label>
              <input id="askingPrice" name="askingPrice" />
            </div>
            <div className="field">
              <label htmlFor="address">物件地址</label>
              <input id="address" name="address" />
            </div>
            <div className="field full">
              <label htmlFor="internalNote">內部備註（不會顯示給屋主）</label>
              <textarea id="internalNote" name="internalNote" />
            </div>
          </div>
          {message ? <div className="form-error">{message}</div> : null}
          <button className="button" disabled={busy} type="submit">
            {busy ? "建立中..." : "建立案件"}
          </button>
        </form>
      ) : null}

      {districts.length ? (
        <div className="filter-row" aria-label="區域篩選">
          <a data-active={districtFilter === "all"} onClick={() => setDistrictFilter("all")} style={{ cursor: "pointer" }}>
            全部區域
          </a>
          {districts.map((d) => (
            <a data-active={districtFilter === d} key={d} onClick={() => setDistrictFilter(d)} style={{ cursor: "pointer" }}>
              {d}
            </a>
          ))}
        </div>
      ) : null}

      {visibleRows.length ? (
        <div className="seller-grid">
          {visibleRows.map(({ seller, latestReportDate }) => {
            const freshness = reportFreshness(latestReportDate);
            return (
              <a className="seller-card" data-status={seller.status} href={`/admin/sellers/${seller.id}`} key={seller.id}>
                <div className="seller-card-top">
                  <strong>{seller.district ? `${seller.district} · ${seller.communityName}` : seller.communityName}</strong>
                  <span className={`tag status-${seller.status}`}>{STATUS_LABEL[seller.status]}</span>
                </div>
                <div className="seller-card-owner">屋主：{seller.ownerName}</div>
                <div className="seller-card-row">
                  委託期間：{formatDate(seller.engagementStart)} ～ {formatDate(seller.engagementEnd)}
                </div>
                <div className="seller-card-row">最新週報：{formatDate(latestReportDate || "")}</div>
                <div className="seller-card-bottom">
                  <span className={`tag freshness-${freshness}`}>{FRESHNESS_LABEL[freshness]}</span>
                  <span className="seller-card-cta">管理案件 →</span>
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">目前還沒有任何案件，按上方「＋ 新增案件」開始。</div>
      )}
    </main>
  );
}
