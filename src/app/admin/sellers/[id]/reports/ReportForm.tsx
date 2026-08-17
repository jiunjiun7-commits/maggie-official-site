"use client";

import { useState } from "react";
import {
  EXPOSURE_CHANNELS,
  STRATEGY_CHECKLIST_OPTIONS,
  type Competitor,
  type Exposure,
  type NextWeekStrategy,
  type SellerReport
} from "@/lib/seller-report-store";
import { isImplausibleYear, IMPLAUSIBLE_YEAR_MESSAGE } from "@/lib/date-guard";

function emptyExposure(): Exposure {
  return Object.fromEntries(EXPOSURE_CHANNELS.map((c) => [c.key, { done: false, note: "" }])) as Exposure;
}

export default function ReportForm({
  sellerId,
  initialReport
}: {
  sellerId: string;
  initialReport?: SellerReport;
}) {
  const [reportDate, setReportDate] = useState(initialReport?.reportDate ?? "");
  const [periodStart, setPeriodStart] = useState(initialReport?.periodStart ?? "");
  const [periodEnd, setPeriodEnd] = useState(initialReport?.periodEnd ?? "");
  const [exposure, setExposure] = useState<Exposure>({ ...emptyExposure(), ...(initialReport?.exposure ?? {}) });
  const [inquiriesWeek, setInquiriesWeek] = useState(String(initialReport?.inquiriesWeek ?? 0));
  const [inquiriesTotal, setInquiriesTotal] = useState(String(initialReport?.inquiriesTotal ?? 0));
  const [viewingsWeek, setViewingsWeek] = useState(String(initialReport?.viewingsWeek ?? 0));
  const [viewingsTotal, setViewingsTotal] = useState(String(initialReport?.viewingsTotal ?? 0));
  const [viewingsPending, setViewingsPending] = useState(String(initialReport?.viewingsPending ?? 0));
  const [feedbackText, setFeedbackText] = useState(initialReport?.feedbackText ?? "");
  const [marketListingsCount, setMarketListingsCount] = useState(initialReport?.marketListingsCount?.toString() ?? "");
  const [marketNewListings, setMarketNewListings] = useState(initialReport?.marketNewListings?.toString() ?? "");
  const [marketPriceCuts, setMarketPriceCuts] = useState(initialReport?.marketPriceCuts?.toString() ?? "");
  const [marketSoldCount, setMarketSoldCount] = useState(initialReport?.marketSoldCount?.toString() ?? "");
  const [marketObservationText, setMarketObservationText] = useState(initialReport?.marketObservationText ?? "");
  const [competitors, setCompetitors] = useState<Competitor[]>(
    (initialReport?.competitors ?? []).map((c) => ({
      name: c.name ?? "",
      price: c.price ?? "",
      totalPing: c.totalPing ?? "",
      layout: c.layout ?? "",
      parking: c.parking ?? "",
      condition: c.condition ?? "",
      url: c.url ?? ""
    }))
  );
  const [maggieNotes, setMaggieNotes] = useState(initialReport?.maggieNotes ?? "");
  const [checklist, setChecklist] = useState<string[]>(initialReport?.nextWeekStrategy?.checklist ?? []);
  const [strategyNote, setStrategyNote] = useState(initialReport?.nextWeekStrategy?.note ?? "");
  const [weeklyGoal, setWeeklyGoal] = useState(initialReport?.weeklyGoal ?? "");
  const [ownerActionNeeded, setOwnerActionNeeded] = useState(initialReport?.ownerActionNeeded ?? "");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function toggleChecklist(item: string) {
    setChecklist((current) => (current.includes(item) ? current.filter((i) => i !== item) : [...current, item]));
  }

  function updateExposure(key: string, patch: Partial<{ done: boolean; note: string }>) {
    setExposure((current) => ({ ...current, [key]: { ...current[key as keyof Exposure], ...patch } }));
  }

  function addCompetitor() {
    setCompetitors((current) => [
      ...current,
      { name: "", price: "", totalPing: "", layout: "", parking: "", condition: "", url: "" }
    ]);
  }

  function updateCompetitor(index: number, patch: Partial<Competitor>) {
    setCompetitors((current) => current.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeCompetitor(index: number) {
    setCompetitors((current) => current.filter((_, i) => i !== index));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (isImplausibleYear(reportDate) || isImplausibleYear(periodStart) || isImplausibleYear(periodEnd)) {
      setMessage(IMPLAUSIBLE_YEAR_MESSAGE);
      return;
    }

    setBusy(true);

    const nextWeekStrategy: NextWeekStrategy = { checklist, note: strategyNote };
    const body = {
      reportDate,
      periodStart,
      periodEnd,
      exposure,
      inquiriesWeek: Number(inquiriesWeek) || 0,
      inquiriesTotal: Number(inquiriesTotal) || 0,
      viewingsWeek: Number(viewingsWeek) || 0,
      viewingsTotal: Number(viewingsTotal) || 0,
      viewingsPending: Number(viewingsPending) || 0,
      feedbackText,
      marketListingsCount: marketListingsCount === "" ? null : Number(marketListingsCount),
      marketNewListings: marketNewListings === "" ? null : Number(marketNewListings),
      marketPriceCuts: marketPriceCuts === "" ? null : Number(marketPriceCuts),
      marketSoldCount: marketSoldCount === "" ? null : Number(marketSoldCount),
      marketObservationText,
      competitors,
      maggieNotes,
      nextWeekStrategy,
      weeklyGoal,
      ownerActionNeeded
    };

    try {
      const url = initialReport
        ? `/api/sellers/${sellerId}/reports/${initialReport.id}`
        : `/api/sellers/${sellerId}/reports`;
      const response = await fetch(url, {
        method: initialReport ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "儲存失敗");
      window.location.href = `/admin/sellers/${sellerId}`;
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "儲存失敗");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <section className="seller-panel">
        <h2>回報基本資訊</h2>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="reportDate">回報日期</label>
            <input id="reportDate" onChange={(e) => setReportDate(e.target.value)} required type="date" value={reportDate} />
          </div>
          <div className="field" />
          <div className="field">
            <label htmlFor="periodStart">報告週期（起）</label>
            <input id="periodStart" onChange={(e) => setPeriodStart(e.target.value)} required type="date" value={periodStart} />
          </div>
          <div className="field">
            <label htmlFor="periodEnd">報告週期（迄）</label>
            <input id="periodEnd" onChange={(e) => setPeriodEnd(e.target.value)} required type="date" value={periodEnd} />
          </div>
        </div>
      </section>

      <section className="seller-panel">
        <h2>本週曝光</h2>
        <div className="exposure-grid">
          {EXPOSURE_CHANNELS.map((channel) => (
            <div className="exposure-item" key={channel.key}>
              <label className="exposure-item-top">
                <span>{channel.label}</span>
                <input
                  checked={Boolean(exposure[channel.key]?.done)}
                  onChange={(e) => updateExposure(channel.key, { done: e.target.checked })}
                  type="checkbox"
                />
              </label>
              <input
                onChange={(e) => updateExposure(channel.key, { note: e.target.value })}
                placeholder="簡短說明（例如：8/3 上架）"
                type="text"
                value={exposure[channel.key]?.note ?? ""}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="seller-panel">
        <h2>市場反應</h2>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="inquiriesWeek">本週詢問組數</label>
            <input id="inquiriesWeek" onChange={(e) => setInquiriesWeek(e.target.value)} type="number" value={inquiriesWeek} />
          </div>
          <div className="field">
            <label htmlFor="inquiriesTotal">累積詢問組數</label>
            <input id="inquiriesTotal" onChange={(e) => setInquiriesTotal(e.target.value)} type="number" value={inquiriesTotal} />
          </div>
          <div className="field">
            <label htmlFor="viewingsWeek">本週帶看組數</label>
            <input id="viewingsWeek" onChange={(e) => setViewingsWeek(e.target.value)} type="number" value={viewingsWeek} />
          </div>
          <div className="field">
            <label htmlFor="viewingsTotal">累積帶看組數</label>
            <input id="viewingsTotal" onChange={(e) => setViewingsTotal(e.target.value)} type="number" value={viewingsTotal} />
          </div>
          <div className="field">
            <label htmlFor="viewingsPending">待安排帶看組數</label>
            <input id="viewingsPending" onChange={(e) => setViewingsPending(e.target.value)} type="number" value={viewingsPending} />
          </div>
        </div>
      </section>

      <section className="seller-panel">
        <h2>客戶／同業回饋</h2>
        <div className="field full">
          <textarea onChange={(e) => setFeedbackText(e.target.value)} value={feedbackText} />
        </div>
      </section>

      <section className="seller-panel">
        <h2>市場觀察</h2>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="marketListingsCount">社區在售件數</label>
            <input id="marketListingsCount" onChange={(e) => setMarketListingsCount(e.target.value)} type="number" value={marketListingsCount} />
          </div>
          <div className="field">
            <label htmlFor="marketNewListings">本週新增件數</label>
            <input id="marketNewListings" onChange={(e) => setMarketNewListings(e.target.value)} type="number" value={marketNewListings} />
          </div>
          <div className="field">
            <label htmlFor="marketPriceCuts">本週降價件數</label>
            <input id="marketPriceCuts" onChange={(e) => setMarketPriceCuts(e.target.value)} type="number" value={marketPriceCuts} />
          </div>
          <div className="field">
            <label htmlFor="marketSoldCount">本週成交件數</label>
            <input id="marketSoldCount" onChange={(e) => setMarketSoldCount(e.target.value)} type="number" value={marketSoldCount} />
          </div>
          <div className="field full">
            <label htmlFor="marketObservationText">市場觀察文字</label>
            <textarea id="marketObservationText" onChange={(e) => setMarketObservationText(e.target.value)} value={marketObservationText} />
          </div>
        </div>
      </section>

      <section className="seller-panel">
        <h2>競品</h2>
        {competitors.map((competitor, index) => (
          <div className="competitor-card" key={index}>
            <div className="competitor-row-top">
              <input
                onChange={(e) => updateCompetitor(index, { name: e.target.value })}
                placeholder="名稱"
                value={competitor.name}
              />
              <input
                onChange={(e) => updateCompetitor(index, { url: e.target.value })}
                placeholder="連結（可選）"
                value={competitor.url}
              />
              <button className="button-secondary" onClick={() => removeCompetitor(index)} type="button">刪除</button>
            </div>
            <div className="competitor-row-bottom">
              <input
                onChange={(e) => updateCompetitor(index, { price: e.target.value })}
                placeholder="開價"
                value={competitor.price}
              />
              <input
                onChange={(e) => updateCompetitor(index, { totalPing: e.target.value })}
                placeholder="總坪數"
                value={competitor.totalPing}
              />
              <input
                onChange={(e) => updateCompetitor(index, { layout: e.target.value })}
                placeholder="格局（例如：大四房）"
                value={competitor.layout}
              />
              <input
                onChange={(e) => updateCompetitor(index, { parking: e.target.value })}
                placeholder="車位"
                value={competitor.parking}
              />
              <input
                onChange={(e) => updateCompetitor(index, { condition: e.target.value })}
                placeholder="狀況"
                value={competitor.condition}
              />
            </div>
          </div>
        ))}
        <button className="button-secondary" onClick={addCompetitor} type="button">＋ 新增競品</button>
      </section>

      <section className="seller-panel">
        <h2>Maggie 本週觀察</h2>
        <div className="field full">
          <textarea onChange={(e) => setMaggieNotes(e.target.value)} value={maggieNotes} />
        </div>
      </section>

      <section className="seller-panel">
        <h2>下週銷售策略</h2>
        <div className="checklist-row">
          {STRATEGY_CHECKLIST_OPTIONS.map((item) => (
            <label className="checklist-item" key={item}>
              <input checked={checklist.includes(item)} onChange={() => toggleChecklist(item)} type="checkbox" />
              {item}
            </label>
          ))}
        </div>
        <div className="field full">
          <textarea onChange={(e) => setStrategyNote(e.target.value)} placeholder="補充說明" value={strategyNote} />
        </div>
      </section>

      <section className="seller-panel">
        <h2>本週重點目標</h2>
        <div className="field full">
          <textarea onChange={(e) => setWeeklyGoal(e.target.value)} value={weeklyGoal} />
        </div>
      </section>

      <section className="seller-panel">
        <h2>需要屋主配合</h2>
        <div className="field full">
          <textarea onChange={(e) => setOwnerActionNeeded(e.target.value)} placeholder="可留空" value={ownerActionNeeded} />
        </div>
      </section>

      {message ? <div className="form-error">{message}</div> : null}
      <button className="button" disabled={busy} type="submit">
        {busy ? "儲存中..." : initialReport ? "儲存變更" : "建立週報"}
      </button>
    </form>
  );
}
