"use client";

import { useState } from "react";
import type { ContentEngine, IgReel, ReelSnapshot } from "@/lib/ig-reel-store";
import { CONTENT_ENGINES, MISSIONS } from "@/lib/ig-reel-store";

export type ReelRow = { reel: IgReel; latest: ReelSnapshot | null };

const ENGINE_LABEL = Object.fromEntries(CONTENT_ENGINES.map((e) => [e.key, e.label])) as Record<
  ContentEngine,
  string
>;

const MISSION_LABEL = Object.fromEntries(MISSIONS.map((m) => [m.key, m.label.split("｜")[0]]));

function formatNum(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("zh-TW");
}

export default function ReelsBoard({ initialRows }: { initialRows: ReelRow[] }) {
  const [rows] = useState(initialRows);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [engineFilter, setEngineFilter] = useState<ContentEngine | "all">("all");

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const secondaryMission = form.get("secondaryMission");
    try {
      const response = await fetch("/api/ig-growth/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publishedDate: form.get("publishedDate"),
          title: form.get("title"),
          series: form.get("series"),
          episode: form.get("episode"),
          contentEngine: form.get("contentEngine"),
          primaryMission: form.get("primaryMission"),
          secondaryMission: secondaryMission ? secondaryMission : null,
          hook: form.get("hook"),
          coverText: form.get("coverText"),
          captionCta: form.get("captionCta"),
          videoLengthSec: form.get("videoLengthSec") ? Number(form.get("videoLengthSec")) : null,
          reelUrl: form.get("reelUrl"),
          experimentHypothesis: form.get("experimentHypothesis")
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "建立失敗");
      window.location.href = `/admin/ig-growth/reels/${payload.reel.id}`;
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "建立失敗");
      setBusy(false);
    }
  }

  const visibleRows = engineFilter === "all" ? rows : rows.filter((r) => r.reel.contentEngine === engineFilter);

  return (
    <main className="admin-shell">
      <div className="admin-heading">
        <div>
          <h1>Reels 資料庫</h1>
          <p>每支 Reel 發布前先設定任務，發布後填 24H/72H/7D 數據。</p>
        </div>
        <button className="button" onClick={() => setShowForm((v) => !v)} type="button">
          {showForm ? "取消" : "＋ 新增 Reel"}
        </button>
      </div>

      {showForm ? (
        <form className="ig-reel-form" onSubmit={submitCreate}>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="publishedDate">發布日期</label>
              <input id="publishedDate" name="publishedDate" required type="date" />
            </div>
            <div className="field">
              <label htmlFor="title">影片名稱</label>
              <input id="title" name="title" required />
            </div>
            <div className="field">
              <label htmlFor="series">Series</label>
              <input id="series" name="series" placeholder="例如：Maggie 帶你看高雄" />
            </div>
            <div className="field">
              <label htmlFor="episode">Episode（可空白）</label>
              <input id="episode" name="episode" />
            </div>
            <div className="field">
              <label htmlFor="contentEngine">Content Engine</label>
              <select id="contentEngine" name="contentEngine" required>
                {CONTENT_ENGINES.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="primaryMission">Primary Mission</label>
              <select id="primaryMission" name="primaryMission" required>
                {MISSIONS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="secondaryMission">Secondary Mission（可空白）</label>
              <select defaultValue="" id="secondaryMission" name="secondaryMission">
                <option value="">（無）</option>
                {MISSIONS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="videoLengthSec">影片長度（秒）</label>
              <input id="videoLengthSec" min={0} name="videoLengthSec" type="number" />
            </div>
            <div className="field full">
              <label htmlFor="hook">Hook</label>
              <input id="hook" name="hook" />
            </div>
            <div className="field full">
              <label htmlFor="coverText">封面文字</label>
              <input id="coverText" name="coverText" />
            </div>
            <div className="field full">
              <label htmlFor="captionCta">Caption CTA</label>
              <input id="captionCta" name="captionCta" />
            </div>
            <div className="field full">
              <label htmlFor="reelUrl">Reel URL</label>
              <input id="reelUrl" name="reelUrl" placeholder="https://instagram.com/reel/..." />
            </div>
            <div className="field full">
              <label htmlFor="experimentHypothesis">Experiment Hypothesis</label>
              <textarea id="experimentHypothesis" name="experimentHypothesis" placeholder="這支影片想驗證什麼？" />
            </div>
          </div>
          {message ? <div className="form-error">{message}</div> : null}
          <button className="button" disabled={busy} type="submit">
            {busy ? "建立中..." : "建立 Reel"}
          </button>
        </form>
      ) : null}

      <div className="ig-filter-row">
        <a
          className="filter-row-item"
          data-active={engineFilter === "all"}
          onClick={() => setEngineFilter("all")}
          style={{
            cursor: "pointer",
            padding: "7px 13px",
            border: "1px solid #2b405e",
            borderRadius: 999,
            color: engineFilter === "all" ? "var(--navy-950)" : "#aebfd4",
            background: engineFilter === "all" ? "var(--gold-500)" : "transparent",
            fontSize: 14,
            fontWeight: 800
          }}
        >
          全部
        </a>
        {CONTENT_ENGINES.map((e) => (
          <a
            key={e.key}
            onClick={() => setEngineFilter(e.key)}
            style={{
              cursor: "pointer",
              padding: "7px 13px",
              border: "1px solid #2b405e",
              borderRadius: 999,
              color: engineFilter === e.key ? "var(--navy-950)" : "#aebfd4",
              background: engineFilter === e.key ? "var(--gold-500)" : "transparent",
              fontSize: 14,
              fontWeight: 800
            }}
          >
            {e.label}
          </a>
        ))}
      </div>

      {visibleRows.length ? (
        <div className="ig-reel-grid">
          {visibleRows.map(({ reel, latest }) => (
            <a className="ig-reel-card" href={`/admin/ig-growth/reels/${reel.id}`} key={reel.id}>
              <div className="ig-reel-card-top">
                <strong>{reel.title}</strong>
                <span className={`tag engine-${reel.contentEngine}`}>{ENGINE_LABEL[reel.contentEngine]}</span>
              </div>
              <div className="ig-reel-meta">
                {reel.publishedDate} · {reel.series || "無系列"}
                {reel.episode ? ` · ${reel.episode}` : ""}
              </div>
              <div className="ig-reel-meta">
                Mission：{MISSION_LABEL[reel.primaryMission]}
                {reel.secondaryMission ? ` / ${MISSION_LABEL[reel.secondaryMission]}` : ""}
                {reel.motherReelType ? " · 🧬 Mother Reel" : ""}
              </div>
              <div className="ig-reel-numbers">
                <span>
                  Views <b>{formatNum(latest?.views ?? null)}</b>
                </span>
                <span>
                  Reach <b>{formatNum(latest?.reach ?? null)}</b>
                </span>
                <span>
                  Follows <b>{formatNum(latest?.follows ?? null)}</b>
                </span>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="empty-state">目前還沒有任何 Reel，按上方「＋ 新增 Reel」開始。</div>
      )}
    </main>
  );
}
