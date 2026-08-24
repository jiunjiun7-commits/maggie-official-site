"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { AreaRuleType, Bbox, MarketRadarArea, MarketRadarAreaRule, Polygon } from "@/lib/market-radar-store";
import type { MapRule } from "../MapAreaPicker";

const AreaMapModal = dynamic(() => import("../MapAreaPicker"), { ssr: false });

const RULE_TYPE_LABEL: Record<AreaRuleType, string> = {
  road: "路段",
  district: "行政區",
  section: "地段",
  community: "社區",
  address_keyword: "地址關鍵字",
  bbox: "地圖框選範圍（矩形）",
  polygon: "地圖框選範圍（多邊形）"
};

const TEXT_RULE_TYPES: AreaRuleType[] = ["road", "district", "section", "community", "address_keyword"];

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
  const [mapMessage, setMapMessage] = useState("");

  const [name, setName] = useState(area.name);
  const [district, setDistrict] = useState(area.district);
  const [note, setNote] = useState(area.note);

  const [newRuleType, setNewRuleType] = useState<AreaRuleType>("road");
  const [newRuleValue, setNewRuleValue] = useState("");
  const [mapModalOpen, setMapModalOpen] = useState(false);

  const [recomputing, setRecomputing] = useState(false);
  const [recomputeResult, setRecomputeResult] = useState<{
    totalEligible: number;
    matchedCount: number;
    insertedCount: number;
    deletedCount: number;
    updatedCount: number;
    unchangedCount: number;
  } | null>(null);

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

  async function addTextRule() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/market-radar/areas/${area.id}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleType: newRuleType, ruleValue: newRuleValue })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "新增規則失敗");
      setRules((prev) => [...prev, payload.rule]);
      setNewRuleValue("");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "新增規則失敗");
    } finally {
      setBusy(false);
    }
  }

  async function removeTextRule(ruleId: string) {
    setBusy(true);
    try {
      await fetch(`/api/market-radar/areas/${area.id}/rules/${ruleId}`, { method: "DELETE" });
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } finally {
      setBusy(false);
    }
  }

  async function handleMapCreate(input: { ruleType: "bbox" | "polygon"; bbox?: Bbox; polygon?: Polygon }): Promise<boolean> {
    setMapMessage("");
    try {
      const response = await fetch(`/api/market-radar/areas/${area.id}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "新增範圍失敗");
      setRules((prev) => [...prev, payload.rule]);
      return true;
    } catch (caught) {
      setMapMessage(caught instanceof Error ? caught.message : "新增範圍失敗");
      return false;
    }
  }

  async function handleMapUpdate(ruleId: string, input: { bbox?: Bbox; polygon?: Polygon }): Promise<boolean> {
    setMapMessage("");
    try {
      const response = await fetch(`/api/market-radar/areas/${area.id}/rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "更新範圍失敗");
      setRules((prev) => prev.map((r) => (r.id === ruleId ? payload.rule : r)));
      return true;
    } catch (caught) {
      setMapMessage(caught instanceof Error ? caught.message : "更新範圍失敗");
      return false;
    }
  }

  async function handleMapDelete(ruleId: string): Promise<void> {
    setMapMessage("");
    try {
      const response = await fetch(`/api/market-radar/areas/${area.id}/rules/${ruleId}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "刪除失敗");
      }
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (caught) {
      setMapMessage(caught instanceof Error ? caught.message : "刪除失敗");
    }
  }

  async function recomputeMatches() {
    const confirmed = window.confirm(
      `會用「${area.name}」目前的地圖範圍規則（bbox／polygon），重新比對所有已有座標的官方交易，並更新命中結果。\n只影響這個區域，不影響其他區域。確定要繼續嗎？`
    );
    if (!confirmed) return;

    setRecomputing(true);
    setRecomputeResult(null);
    setMessage("");
    try {
      const response = await fetch(`/api/market-radar/areas/${area.id}/recompute-matches`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "重新計算失敗");
      setRecomputeResult(payload.result);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "重新計算失敗");
    } finally {
      setRecomputing(false);
    }
  }

  const textRules = useMemo(() => rules.filter((r) => TEXT_RULE_TYPES.includes(r.ruleType)), [rules]);
  const mapRules = useMemo<MapRule[]>(
    () => rules.filter((r) => r.ruleType === "bbox" || r.ruleType === "polygon").map((r) => ({ id: r.id, ruleType: r.ruleType as "bbox" | "polygon", bbox: r.bbox, polygon: r.polygon })),
    [rules]
  );

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
            <label htmlFor="district">所屬行政區（僅輔助資訊，不單獨決定歸屬）</label>
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
        <div className="admin-heading" style={{ marginBottom: 0 }}>
          <h2 style={{ margin: 0 }}>地圖範圍（{mapRules.length} 個）</h2>
          <button className="button-secondary" disabled={recomputing} onClick={recomputeMatches} type="button">
            {recomputing ? "計算中..." : "重新計算此區域的命中結果"}
          </button>
        </div>
        <p style={{ color: "#9fb0c7", fontSize: 13, marginTop: 6, marginBottom: 12 }}>
          同一個區域可以同時保留多個範圍，彼此不互斥，任一範圍命中即算命中這個區域。
          「重新計算」只會用目前的地圖範圍，重新比對所有已有座標的官方交易，不做文字規則 fallback，不處理地號地址。
        </p>
        {recomputeResult ? (
          <div className="radar-panel" style={{ marginBottom: 12, background: "#0b1626" }}>
            本次比對 {recomputeResult.totalEligible} 筆有座標交易，命中 {recomputeResult.matchedCount} 筆（新增 {recomputeResult.insertedCount}、移除{" "}
            {recomputeResult.deletedCount}、更新 {recomputeResult.updatedCount}、不變 {recomputeResult.unchangedCount}）。
          </div>
        ) : null}

        <button className="button" onClick={() => setMapModalOpen(true)} type="button">
          新增／編輯地圖範圍
        </button>
        {mapMessage ? <div className="form-error">{mapMessage}</div> : null}

        <AreaMapModal
          areaName={area.name}
          busy={busy}
          onClose={() => setMapModalOpen(false)}
          onCreate={handleMapCreate}
          onDelete={handleMapDelete}
          onUpdate={handleMapUpdate}
          open={mapModalOpen}
          rules={mapRules}
        />
      </div>

      <div className="radar-panel">
        <h2>文字規則（{textRules.length} 條）</h2>
        <p style={{ color: "#9fb0c7", fontSize: 13, marginTop: -6, marginBottom: 12 }}>
          判定優先順序：地圖範圍（矩形／多邊形）＞ 社區 ＞ 路段／地段／地址關鍵字 ＞ 行政區（僅輔助）。
        </p>
        {textRules.length ? (
          <div className="rule-list">
            {textRules.map((rule) => (
              <div className="rule-row" key={rule.id}>
                <span>
                  <span className="rule-row-type">{RULE_TYPE_LABEL[rule.ruleType]}</span>
                  {rule.ruleValue}
                </span>
                <button className="button-danger" disabled={busy} onClick={() => removeTextRule(rule.id)} type="button">
                  刪除
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">尚未設定任何文字規則。</div>
        )}

        <div className="rule-add-row">
          <select onChange={(e) => setNewRuleType(e.target.value as AreaRuleType)} value={newRuleType}>
            {TEXT_RULE_TYPES.map((type) => (
              <option key={type} value={type}>
                {RULE_TYPE_LABEL[type]}
              </option>
            ))}
          </select>
          <input
            onChange={(e) => setNewRuleValue(e.target.value)}
            placeholder={newRuleType === "road" ? "例如：大順三路" : newRuleType === "section" ? "例如：農十六段" : "請輸入規則內容"}
            value={newRuleValue}
          />
          <button className="button" disabled={busy || !newRuleValue.trim()} onClick={addTextRule} type="button">
            新增規則
          </button>
        </div>
      </div>
    </main>
  );
}
