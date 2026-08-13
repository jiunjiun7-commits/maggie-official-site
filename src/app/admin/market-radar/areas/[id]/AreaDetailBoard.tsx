"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { AreaRuleType, Bbox, MarketRadarArea, MarketRadarAreaRule } from "@/lib/market-radar-store";

const MapAreaPicker = dynamic(() => import("../MapAreaPicker"), {
  ssr: false,
  loading: () => <div className="map-area-picker-map" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#9fb0c7" }}>地圖載入中...</div>
});

const RULE_TYPE_LABEL: Record<AreaRuleType, string> = {
  road: "路段",
  district: "行政區",
  section: "地段",
  community: "社區",
  address_keyword: "地址關鍵字",
  bbox: "地圖框選範圍"
};

const TEXT_RULE_TYPES: AreaRuleType[] = ["road", "district", "section", "community", "address_keyword"];

function formatBbox(bbox: Bbox) {
  return `北 ${bbox.north.toFixed(4)} / 南 ${bbox.south.toFixed(4)} / 東 ${bbox.east.toFixed(4)} / 西 ${bbox.west.toFixed(4)}`;
}

export default function AreaDetailBoard({
  initialArea,
  initialRules
}: {
  initialArea: MarketRadarArea;
  initialRules: MarketRadarAreaRule[];
}) {
  const [area, setArea] = useState(initialArea);
  const [rules, setRules] = useState(initialRules);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [name, setName] = useState(area.name);
  const [district, setDistrict] = useState(area.district);
  const [note, setNote] = useState(area.note);

  const [newRuleType, setNewRuleType] = useState<AreaRuleType>("road");
  const [newRuleValue, setNewRuleValue] = useState("");
  const [newBbox, setNewBbox] = useState<Bbox | null>(null);

  async function saveBasics(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/market-radar/areas/${area.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, district, note })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "更新失敗");
      setArea(payload.area);
      setMessage("已儲存");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "更新失敗");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    setBusy(true);
    try {
      const response = await fetch(`/api/market-radar/areas/${area.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !area.isActive })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "更新失敗");
      setArea(payload.area);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "更新失敗");
    } finally {
      setBusy(false);
    }
  }

  async function addRule() {
    setBusy(true);
    setMessage("");
    try {
      const body =
        newRuleType === "bbox"
          ? { ruleType: newRuleType, bbox: newBbox }
          : { ruleType: newRuleType, ruleValue: newRuleValue };
      const response = await fetch(`/api/market-radar/areas/${area.id}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "新增規則失敗");
      setRules((prev) => [...prev, payload.rule]);
      setNewRuleValue("");
      setNewBbox(null);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "新增規則失敗");
    } finally {
      setBusy(false);
    }
  }

  async function removeRule(ruleId: string) {
    setBusy(true);
    try {
      await fetch(`/api/market-radar/areas/${area.id}/rules/${ruleId}`, { method: "DELETE" });
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-shell">
      <div className="admin-heading">
        <div>
          <h1>{area.name}</h1>
          <p>管理這個監控區域的基本資料，以及用來判定「哪些交易屬於這個區域」的規則。</p>
        </div>
        <button className="button-secondary" disabled={busy} onClick={toggleActive} type="button">
          {area.isActive ? "停用此區域" : "重新啟用"}
        </button>
      </div>

      <div className="radar-panel">
        <h2>基本資料</h2>
        <form className="field-grid" onSubmit={saveBasics}>
          <div className="field">
            <label htmlFor="name">區域名稱</label>
            <input id="name" onChange={(e) => setName(e.target.value)} required value={name} />
          </div>
          <div className="field">
            <label htmlFor="district">所屬行政區</label>
            <input id="district" onChange={(e) => setDistrict(e.target.value)} value={district} />
          </div>
          <div className="field full">
            <label htmlFor="note">備註</label>
            <textarea id="note" onChange={(e) => setNote(e.target.value)} value={note} />
          </div>
          <div className="field full">
            <button className="button" disabled={busy} type="submit">
              {busy ? "處理中..." : "儲存基本資料"}
            </button>
          </div>
        </form>
        {message ? <div className="form-error">{message}</div> : null}
      </div>

      <div className="radar-panel">
        <h2>判定規則（{rules.length} 條）</h2>
        {rules.length ? (
          <div className="rule-list">
            {rules.map((rule) => (
              <div className="rule-row" key={rule.id}>
                <span>
                  <span className="rule-row-type">{RULE_TYPE_LABEL[rule.ruleType]}</span>
                  {rule.ruleType === "bbox" && rule.bbox ? formatBbox(rule.bbox) : rule.ruleValue}
                </span>
                <button className="button-danger" disabled={busy} onClick={() => removeRule(rule.id)} type="button">
                  刪除
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">尚未設定任何判定規則，交易資料還無法自動歸類到這個區域。</div>
        )}

        <div className="rule-add-row">
          <select onChange={(e) => setNewRuleType(e.target.value as AreaRuleType)} value={newRuleType}>
            {(["road", "district", "section", "community", "address_keyword", "bbox"] as AreaRuleType[]).map((type) => (
              <option key={type} value={type}>
                {RULE_TYPE_LABEL[type]}
              </option>
            ))}
          </select>
          {TEXT_RULE_TYPES.includes(newRuleType) ? (
            <>
              <input
                onChange={(e) => setNewRuleValue(e.target.value)}
                placeholder={newRuleType === "road" ? "例如：大順三路" : newRuleType === "section" ? "例如：農十六段" : "請輸入規則內容"}
                value={newRuleValue}
              />
              <button className="button" disabled={busy || !newRuleValue.trim()} onClick={addRule} type="button">
                新增規則
              </button>
            </>
          ) : (
            <button className="button" disabled={busy || !newBbox} onClick={addRule} type="button">
              新增框選規則
            </button>
          )}
        </div>

        {newRuleType === "bbox" ? <MapAreaPicker onChange={setNewBbox} value={newBbox} /> : null}
      </div>
    </main>
  );
}
