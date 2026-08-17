"use client";

import { useState } from "react";
import type { Seller, SellerStatus } from "@/lib/seller-store";
import type { SellerReport } from "@/lib/seller-report-store";
import { isImplausibleYear, IMPLAUSIBLE_YEAR_MESSAGE } from "@/lib/date-guard";

const STATUS_LABEL: Record<SellerStatus, string> = {
  active: "服務中",
  sold: "已成交",
  ended: "已結束"
};

function formatDate(value: string) {
  return value ? value.slice(0, 10) : "—";
}

export default function SellerDetailBoard({
  initialSeller,
  initialReports,
  initialHasToken
}: {
  initialSeller: Seller;
  initialReports: SellerReport[];
  initialHasToken: boolean;
}) {
  const [seller, setSeller] = useState(initialSeller);
  const [reports] = useState(initialReports);
  const [hasToken, setHasToken] = useState(initialHasToken);
  const [savedToken, setSavedToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submitBasicInfo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const engagementStart = String(form.get("engagementStart") || "");
    const engagementEnd = String(form.get("engagementEnd") || "");
    if (isImplausibleYear(engagementStart) || isImplausibleYear(engagementEnd)) {
      setMessage(IMPLAUSIBLE_YEAR_MESSAGE);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/sellers/${seller.id}`, {
        method: "PATCH",
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
          internalNote: form.get("internalNote"),
          status: form.get("status")
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "更新失敗");
      setSeller(payload.seller);
      setMessage("已儲存。");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "更新失敗");
    } finally {
      setBusy(false);
    }
  }

  async function issueToken() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/sellers/${seller.id}/token`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "產生連結失敗");
      setSavedToken(payload.portalPath);
      setHasToken(true);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "產生連結失敗");
    } finally {
      setBusy(false);
    }
  }

  async function revokeToken() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/sellers/${seller.id}/token`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "撤銷失敗");
      setHasToken(false);
      setSavedToken("");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "撤銷失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-shell">
      <div className="admin-heading">
        <div>
          <h1>{seller.district ? `${seller.district} · ${seller.communityName}` : seller.communityName}</h1>
          <p>
            <a href="/admin/sellers" style={{ color: "var(--gold-400)" }}>← 回案件列表</a>
          </p>
        </div>
        <a className="button" href={`/admin/sellers/${seller.id}/reports/new`}>＋ 新增週報</a>
      </div>

      {message ? <div className="form-error">{message}</div> : null}

      <div className="seller-detail-grid">
        <div>
          <section className="seller-panel">
            <h2>每週 Seller Report</h2>
            {reports.length ? (
              <div className="report-list">
                {reports.map((report) => (
                  <a className="report-row" href={`/admin/sellers/${seller.id}/reports/${report.id}`} key={report.id}>
                    <span>{formatDate(report.reportDate)} 週報</span>
                    <span className="report-row-period">
                      {formatDate(report.periodStart)} ～ {formatDate(report.periodEnd)}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="empty-state">還沒有任何週報，按右上角「＋ 新增週報」建立第一筆。</div>
            )}
          </section>
        </div>

        <div>
          <section className="seller-panel">
            <h2>基本資料</h2>
            <form className="field-grid" onSubmit={submitBasicInfo}>
              <div className="field">
                <label htmlFor="district">區域</label>
                <input defaultValue={seller.district} id="district" name="district" placeholder="例如：前鎮區" />
              </div>
              <div className="field">
                <label htmlFor="communityName">社區/案名</label>
                <input defaultValue={seller.communityName} id="communityName" name="communityName" required />
              </div>
              <div className="field full">
                <label htmlFor="listingTitle">完整物件標題（選填，內部用）</label>
                <input defaultValue={seller.listingTitle} id="listingTitle" name="listingTitle" />
              </div>
              <div className="field full">
                <label htmlFor="ownerName">屋主姓名（僅後台）</label>
                <input defaultValue={seller.ownerName} id="ownerName" name="ownerName" required />
              </div>
              <div className="field">
                <label htmlFor="engagementStart">委託開始日</label>
                <input defaultValue={seller.engagementStart} id="engagementStart" name="engagementStart" type="date" required />
              </div>
              <div className="field">
                <label htmlFor="engagementEnd">委託結束日</label>
                <input defaultValue={seller.engagementEnd} id="engagementEnd" name="engagementEnd" type="date" required />
              </div>
              <div className="field full">
                <label htmlFor="askingPrice">開價</label>
                <input defaultValue={seller.askingPrice} id="askingPrice" name="askingPrice" />
              </div>
              <div className="field full">
                <label htmlFor="address">物件地址</label>
                <input defaultValue={seller.address} id="address" name="address" />
              </div>
              <div className="field full">
                <label htmlFor="status">目前狀態</label>
                <select defaultValue={seller.status} id="status" name="status">
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="field full">
                <label htmlFor="internalNote">內部備註（不會顯示給屋主）</label>
                <textarea defaultValue={seller.internalNote} id="internalNote" name="internalNote" />
              </div>
              <div className="field full">
                <button className="button" disabled={busy} type="submit">
                  {busy ? "儲存中..." : "儲存基本資料"}
                </button>
              </div>
            </form>
          </section>

          <section className="seller-panel">
            <h2>屋主專屬連結</h2>
            <div className="token-box">
              <p style={{ margin: 0, color: "#9fb0c7", fontSize: 13 }}>
                {hasToken ? "目前有一組有效連結。" : "目前還沒有產生連結。"}
              </p>
              {savedToken ? (
                <>
                  <div className="token-value">{typeof window !== "undefined" ? `${window.location.origin}${savedToken}` : savedToken}</div>
                  <p style={{ margin: 0, color: "#ffb2bb", fontSize: 12 }}>
                    這組連結只會顯示這一次，請立即複製傳給屋主。
                  </p>
                </>
              ) : null}
              <div className="token-actions">
                <button className="button-secondary" disabled={busy} onClick={issueToken} type="button">
                  {hasToken ? "重新產生連結" : "產生連結"}
                </button>
                {hasToken ? (
                  <button className="button-danger" disabled={busy} onClick={revokeToken} type="button">
                    撤銷連結
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
