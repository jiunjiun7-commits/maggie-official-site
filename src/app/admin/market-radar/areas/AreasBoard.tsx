"use client";

import Link from "next/link";
import { useState } from "react";
import type { MarketRadarArea } from "@/lib/market-radar-store";

export default function AreasBoard({ initialAreas }: { initialAreas: MarketRadarArea[] }) {
  const [areas] = useState(initialAreas);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/market-radar/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          district: form.get("district"),
          note: form.get("note")
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "建立失敗");
      window.location.href = `/admin/market-radar/areas/${payload.area.id}`;
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "建立失敗");
      setBusy(false);
    }
  }

  return (
    <main className="admin-shell">
      <div className="admin-heading">
        <div>
          <h1>區域管理</h1>
          <p>自訂高雄房市情報雷達要監控的區域／商圈，每個區域可設定多條判定規則（路段、地段、地址關鍵字或地圖框選範圍）。</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link className="button-secondary" href="/admin/market-radar/communities">
            社區資料庫
          </Link>
          <button className="button" onClick={() => setShowForm((v) => !v)} type="button">
            {showForm ? "取消" : "＋ 新增區域"}
          </button>
        </div>
      </div>

      {showForm ? (
        <form className="radar-form" onSubmit={submitCreate}>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="name">區域名稱</label>
              <input id="name" name="name" placeholder="例如：農十六" required />
            </div>
            <div className="field">
              <label htmlFor="district">所屬行政區（選填）</label>
              <input id="district" name="district" placeholder="例如：左營區" />
            </div>
            <div className="field full">
              <label htmlFor="note">備註（選填）</label>
              <textarea id="note" name="note" />
            </div>
          </div>
          {message ? <div className="form-error">{message}</div> : null}
          <button className="button" disabled={busy} type="submit">
            {busy ? "建立中..." : "建立區域"}
          </button>
        </form>
      ) : null}

      {areas.length ? (
        <div className="radar-grid">
          {areas.map((area) => (
            <a className="radar-card" data-active={area.isActive} href={`/admin/market-radar/areas/${area.id}`} key={area.id}>
              <div className="radar-card-top">
                <strong>{area.district ? `${area.district} · ${area.name}` : area.name}</strong>
                <span className={`tag active-${area.isActive}`}>{area.isActive ? "監控中" : "已停用"}</span>
              </div>
              {area.note ? <div className="radar-card-row">{area.note}</div> : null}
              <div className="radar-card-bottom">
                <span />
                <span className="radar-card-cta">管理規則 →</span>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="empty-state">目前還沒有任何監控區域，按上方「＋ 新增區域」開始。</div>
      )}
    </main>
  );
}
