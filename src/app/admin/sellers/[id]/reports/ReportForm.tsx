"use client";

import { useState } from "react";
import {
  describeExposureAutoSnapshot,
  EXPOSURE_AUTO_STATUS_LABEL,
  EXPOSURE_CAPABILITY_LABEL,
  EXPOSURE_CHANNELS,
  EXPOSURE_TRACKING_CAPABILITY,
  MANUAL_EXPOSURE_CHANNELS,
  PRIMARY_EXPOSURE_PLATFORMS,
  STRATEGY_CHECKLIST_OPTIONS,
  type Competitor,
  type Exposure,
  type ExposureAutoSnapshot,
  type NextWeekStrategy,
  type PrimaryExposurePlatform,
  type SellerReport
} from "@/lib/seller-report-store";
import type { ExposureLink } from "@/lib/seller-exposure-store";
import { isImplausibleYear, IMPLAUSIBLE_YEAR_MESSAGE } from "@/lib/date-guard";

function emptyExposure(): Exposure {
  return Object.fromEntries(EXPOSURE_CHANNELS.map((c) => [c.key, { done: false, note: "" }])) as Exposure;
}

function formatCheckedAt(value: string) {
  if (!value) return "尚未檢查";
  return new Date(value).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function statusTone(status: ExposureAutoSnapshot["status"] | undefined) {
  if (status === "normal") return "good";
  if (status === "inactive") return "bad";
  if (status === "attention") return "warn";
  return "mute";
}

export default function ReportForm({
  sellerId,
  initialReport,
  exposureLinks,
  autoSnapshots
}: {
  sellerId: string;
  initialReport?: SellerReport;
  /** 案件在「曝光管理」設定的四個平台連結，用來顯示「已持續刊登 N 天」跟目前狀態。 */
  exposureLinks: ExposureLink[];
  /**
   * 只有新增週報時才會傳入——用「報告週期」當下算出的追蹤快照，寫進 exposure.auto 之後就固定，
   * 不會因為之後 cron 又抓到新數字而回頭改到已建立的週報。編輯既有週報時不傳，
   * 直接沿用 initialReport.exposure 裡已經存好的 auto 快照。
   */
  autoSnapshots?: Partial<Record<PrimaryExposurePlatform, ExposureAutoSnapshot>>;
}) {
  const [reportDate, setReportDate] = useState(initialReport?.reportDate ?? "");
  const [periodStart, setPeriodStart] = useState(initialReport?.periodStart ?? "");
  const [periodEnd, setPeriodEnd] = useState(initialReport?.periodEnd ?? "");
  const [exposure, setExposure] = useState<Exposure>(() => {
    const base: Exposure = { ...emptyExposure(), ...(initialReport?.exposure ?? {}) };
    // 只有新增週報（沒有 initialReport）才用當下算出的快照預填自動摘要句；
    // 編輯既有週報就不動，沿用已經存在 initialReport.exposure 裡的凍結內容。
    if (!initialReport && autoSnapshots) {
      for (const platform of PRIMARY_EXPOSURE_PLATFORMS) {
        const snapshot = autoSnapshots[platform.key];
        if (!snapshot) continue;
        base[platform.key] = {
          done: snapshot.status !== "inactive",
          note: describeExposureAutoSnapshot(platform.label, snapshot),
          auto: snapshot
        };
      }
    }
    return base;
  });
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
        <h2>主要平台曝光</h2>
        <div className="primary-exposure-grid">
          {PRIMARY_EXPOSURE_PLATFORMS.map((platform) => {
            const capability = EXPOSURE_TRACKING_CAPABILITY[platform.key];
            const link = exposureLinks.find((l) => l.platform === platform.key) ?? null;
            const entry = exposure[platform.key] ?? { done: false, note: "" };
            const activeDays =
              link && periodEnd
                ? Math.max(0, Math.floor((new Date(periodEnd).getTime() - new Date(link.startedAt).getTime()) / 86_400_000))
                : null;

            if (!link) {
              return (
                <div className="primary-exposure-card is-unset" key={platform.key}>
                  <div className="primary-exposure-top">
                    <strong>{platform.label}</strong>
                    <span className="cap-tag">{EXPOSURE_CAPABILITY_LABEL[capability]}</span>
                  </div>
                  <p>
                    尚未設定追蹤網址，請到案件的「
                    <a href={`/admin/sellers/${sellerId}`}>曝光管理</a>」設定。
                  </p>
                </div>
              );
            }

            if (capability === "manual") {
              return (
                <div className="primary-exposure-card" key={platform.key}>
                  <div className="primary-exposure-top">
                    <strong>{platform.label}</strong>
                    <span className="cap-tag">{EXPOSURE_CAPABILITY_LABEL[capability]}</span>
                  </div>
                  {activeDays !== null ? <div className="primary-exposure-days">已持續刊登 {activeDays} 天</div> : null}
                  <label className="primary-exposure-toggle">
                    本週已曝光
                    <input
                      checked={entry.done}
                      onChange={(e) => updateExposure(platform.key, { done: e.target.checked })}
                      type="checkbox"
                    />
                  </label>
                  <input
                    onChange={(e) => updateExposure(platform.key, { note: e.target.value })}
                    placeholder="簡短說明（例如：8/3 上架）"
                    type="text"
                    value={entry.note}
                  />
                </div>
              );
            }

            const auto = entry.auto;
            return (
              <div className="primary-exposure-card" key={platform.key}>
                <div className="primary-exposure-top">
                  <strong>{platform.label}</strong>
                  <span className={`pill pill--${statusTone(auto?.status)}`}>
                    {auto ? EXPOSURE_AUTO_STATUS_LABEL[auto.status] : EXPOSURE_AUTO_STATUS_LABEL.unverifiable}
                  </span>
                </div>
                <span className="cap-tag">{EXPOSURE_CAPABILITY_LABEL[capability]}</span>
                {activeDays !== null ? <div className="primary-exposure-days">已持續刊登 {activeDays} 天</div> : null}
                {auto?.status === "inactive" ? (
                  <div className="primary-exposure-nodata">請確認是否下架、換網址或重新刊登</div>
                ) : auto && auto.cumulativeViews !== null ? (
                  <div className="primary-exposure-metrics">
                    <div>
                      <span className="num">{auto.cumulativeViews}</span>
                      <span className="label">累積瀏覽</span>
                    </div>
                    {auto.weeklyViewDelta !== null ? (
                      <div>
                        <span className="num delta">
                          {auto.weeklyViewDelta >= 0 ? "+" : ""}
                          {auto.weeklyViewDelta}
                        </span>
                        <span className="label">本週新增</span>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="primary-exposure-nodata">瀏覽數：平台無法自動取得</div>
                )}
                {auto?.lastCheckedAt ? <div className="primary-exposure-checked">最後檢查：{formatCheckedAt(auto.lastCheckedAt)}</div> : null}
                <div className="field">
                  <label htmlFor={`summary-${platform.key}`}>本週摘要（自動產生，可修改）</label>
                  <textarea
                    id={`summary-${platform.key}`}
                    onChange={(e) => updateExposure(platform.key, { note: e.target.value })}
                    value={entry.note}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="seller-panel">
        <h2>人工曝光</h2>
        <div className="exposure-grid">
          {MANUAL_EXPOSURE_CHANNELS.map((channel) => (
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
