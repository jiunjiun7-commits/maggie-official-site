"use client";

import Link from "next/link";
import { useState } from "react";
import type { Community, MarketRadarArea } from "@/lib/market-radar-store";

export default function CommunitiesBoard({
  initialCommunities,
  areas
}: {
  initialCommunities: Community[];
  areas: MarketRadarArea[];
}) {
  const [communities, setCommunities] = useState(initialCommunities);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const areaNameById = new Map(areas.map((a) => [a.id, a.name]));

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/market-radar/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          areaId: form.get("areaId") || null,
          district: form.get("district"),
          addressKeyword: form.get("addressKeyword"),
          note: form.get("note")
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "建立失敗");
      setCommunities((prev) => [payload.community, ...prev]);
      setShowForm(false);
      event.currentTarget.reset();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "建立失敗");
    } finally {
      setBusy(false);
    }
  }

  async function removeCommunity(id: string) {
    if (!confirm("確定要刪除這個社區資料嗎？")) return;
    setBusy(true);
    try {
      await fetch(`/api/market-radar/communities/${id}`, { method: "DELETE" });
      setCommunities((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-shell">
      <div className="admin-heading">
        <div>
          <h1>社區資料庫</h1>
          <p>登記各監控區域內的社區，之後實價登錄與公司成交情報都會關聯到這裡的社區資料。</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link className="button-secondary" href="/admin/market-radar/areas">
            區域管理
          </Link>
          <button className="button" onClick={() => setShowForm((v) => !v)} type="button">
            {showForm ? "取消" : "＋ 新增社區"}
          </button>
        </div>
      </div>

      {showForm ? (
        <form className="radar-form" onSubmit={submitCreate}>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="name">社區名稱</label>
              <input id="name" name="name" placeholder="例如：中都One" required />
            </div>
            <div className="field">
              <label htmlFor="areaId">所屬監控區域</label>
              <select id="areaId" name="areaId">
                <option value="">未指定</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="district">行政區</label>
              <input id="district" name="district" placeholder="例如：三民區" />
            </div>
            <div className="field">
              <label htmlFor="addressKeyword">地址關鍵字（用於比對實登地址）</label>
              <input id="addressKeyword" name="addressKeyword" placeholder="例如：九如二路" />
            </div>
            <div className="field full">
              <label htmlFor="note">備註</label>
              <textarea id="note" name="note" />
            </div>
          </div>
          {message ? <div className="form-error">{message}</div> : null}
          <button className="button" disabled={busy} type="submit">
            {busy ? "建立中..." : "建立社區"}
          </button>
        </form>
      ) : null}

      {communities.length ? (
        <div className="radar-grid">
          {communities.map((community) => (
            <div className="radar-card" data-active="true" key={community.id}>
              <div className="radar-card-top">
                <strong>{community.name}</strong>
                {community.areaId ? <span className="tag active-true">{areaNameById.get(community.areaId) ?? "區域"}</span> : null}
              </div>
              {community.district ? <div className="radar-card-row">行政區：{community.district}</div> : null}
              {community.addressKeyword ? <div className="radar-card-row">地址關鍵字：{community.addressKeyword}</div> : null}
              {community.note ? <div className="radar-card-row">{community.note}</div> : null}
              <div className="radar-card-bottom">
                <span />
                <button className="button-danger" disabled={busy} onClick={() => removeCommunity(community.id)} type="button">
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">目前還沒有任何社區資料，按上方「＋ 新增社區」開始。</div>
      )}
    </main>
  );
}
