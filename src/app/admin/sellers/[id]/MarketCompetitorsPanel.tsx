"use client";

import { useState } from "react";
import type { MarketCompetitor, MarketCompetitorStatus } from "@/lib/seller-market-store";

const PLATFORM_SUGGESTIONS = ["591", "樂屋網", "信義房屋", "住商", "永慶", "台慶", "永義", "其他"];

const STATUS_LABEL: Record<MarketCompetitorStatus, string> = {
  available: "在售",
  price_cut: "降價",
  sold: "成交",
  delisted: "下架"
};

function formatPrice(priceWan: number | null) {
  return priceWan === null ? "—" : `${priceWan.toLocaleString("zh-TW")}萬`;
}

function formatDate(value: string) {
  return value ? value.slice(0, 10) : "—";
}

export default function MarketCompetitorsPanel({
  sellerId,
  initialCompetitors
}: {
  sellerId: string;
  initialCompetitors: MarketCompetitor[];
}) {
  const [competitors, setCompetitors] = useState(initialCompetitors);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch(`/api/sellers/${sellerId}/market-competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: form.get("platform"),
          listingUrl: form.get("listingUrl"),
          title: form.get("title"),
          priceWan: form.get("priceWan"),
          note: form.get("note")
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "新增失敗");
      setCompetitors((current) => [payload.competitor, ...current]);
      setShowForm(false);
      (event.target as HTMLFormElement).reset();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "新增失敗");
    } finally {
      setBusy(false);
    }
  }

  async function patchCompetitor(id: string, patch: Record<string, unknown>) {
    setMessage("");
    try {
      const response = await fetch(`/api/sellers/${sellerId}/market-competitors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "更新失敗");
      setCompetitors((current) => current.map((c) => (c.id === id ? payload.competitor : c)));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "更新失敗");
    }
  }

  async function removeCompetitor(id: string) {
    setMessage("");
    try {
      const response = await fetch(`/api/sellers/${sellerId}/market-competitors/${id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "刪除失敗");
      setCompetitors((current) => current.filter((c) => c.id !== id));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "刪除失敗");
    }
  }

  return (
    <section className="seller-panel">
      <div className="panel-head-row">
        <h2>競品追蹤</h2>
        <button className="button-secondary" onClick={() => setShowForm((v) => !v)} type="button">
          {showForm ? "取消" : "＋ 新增競品"}
        </button>
      </div>
      <p className="market-competitors-hint">
        不限平台，手動加入正在關注的同社區／同類型物件網址；價格與狀態的變化會自動反映在每週的「市場觀察」裡。
      </p>

      {message ? <div className="form-error">{message}</div> : null}

      {showForm ? (
        <form className="market-competitor-form" onSubmit={submitCreate}>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="platform">平台</label>
              <input id="platform" list="platform-suggestions" name="platform" placeholder="例如：591" required />
              <datalist id="platform-suggestions">
                {PLATFORM_SUGGESTIONS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label htmlFor="title">物件標題</label>
              <input id="title" name="title" placeholder="例如：中山首府高樓層3房" required />
            </div>
            <div className="field full">
              <label htmlFor="listingUrl">物件網址</label>
              <input id="listingUrl" name="listingUrl" placeholder="https://..." required type="url" />
            </div>
            <div className="field">
              <label htmlFor="priceWan">開價（萬元，選填）</label>
              <input id="priceWan" min="0" name="priceWan" step="1" type="number" />
            </div>
            <div className="field">
              <label htmlFor="note">備註（選填）</label>
              <input id="note" name="note" />
            </div>
          </div>
          <button className="button" disabled={busy} type="submit">
            {busy ? "新增中..." : "新增競品"}
          </button>
        </form>
      ) : null}

      {competitors.length ? (
        <div className="market-competitor-list">
          {competitors.map((competitor) => (
            <div className="market-competitor-row" key={competitor.id}>
              <div className="market-competitor-main">
                <span className="cap-tag">{competitor.platform}</span>
                <a href={competitor.listingUrl} rel="noreferrer" target="_blank">
                  {competitor.title}
                </a>
                <span>{formatPrice(competitor.priceWan)}</span>
              </div>
              <div className="market-competitor-controls">
                <input
                  defaultValue={competitor.priceWan ?? ""}
                  onBlur={(e) => {
                    const value = e.target.value === "" ? null : Number(e.target.value);
                    if (value !== competitor.priceWan) patchCompetitor(competitor.id, { priceWan: value });
                  }}
                  placeholder="開價"
                  step="1"
                  type="number"
                />
                <select
                  defaultValue={competitor.status}
                  onChange={(e) => patchCompetitor(competitor.id, { status: e.target.value })}
                >
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  defaultValue={competitor.note}
                  onBlur={(e) => {
                    if (e.target.value !== competitor.note) patchCompetitor(competitor.id, { note: e.target.value });
                  }}
                  placeholder="備註"
                />
                <span className="market-competitor-tracked">加入追蹤：{formatDate(competitor.createdAt)}</span>
                <button className="button-secondary" onClick={() => removeCompetitor(competitor.id)} type="button">
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">還沒有追蹤中的競品，按上方「＋ 新增競品」開始。</div>
      )}
    </section>
  );
}
