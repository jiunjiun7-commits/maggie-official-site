"use client";

import { useState } from "react";
import type { ContentEngine, IgReel, Mission, ReelSnapshot, SnapshotStage } from "@/lib/ig-reel-store";
import { CONTENT_ENGINES, EXPERIMENT_RESULTS, MISSIONS, MOTHER_REEL_TYPES, SNAPSHOT_STAGES } from "@/lib/ig-reel-store";

const ENGINE_LABEL = Object.fromEntries(CONTENT_ENGINES.map((e) => [e.key, e.label])) as Record<
  ContentEngine,
  string
>;
const MISSION_LABEL = Object.fromEntries(MISSIONS.map((m) => [m.key, m.label.split("｜")[0]])) as Record<
  Mission,
  string
>;

type SnapshotMap = Record<SnapshotStage, ReelSnapshot | null>;

function toMap(snapshots: ReelSnapshot[]): SnapshotMap {
  const map: SnapshotMap = { "24h": null, "72h": null, "7d": null, final: null };
  for (const snapshot of snapshots) map[snapshot.stage] = snapshot;
  return map;
}

function num(value: FormDataEntryValue | null): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ReelDetailBoard({
  initialReel,
  initialSnapshots
}: {
  initialReel: IgReel;
  initialSnapshots: ReelSnapshot[];
}) {
  const [reel, setReel] = useState(initialReel);
  const [snapshots, setSnapshots] = useState<SnapshotMap>(() => toMap(initialSnapshots));
  const [activeStage, setActiveStage] = useState<SnapshotStage>("24h");
  const [paid, setPaid] = useState(snapshots["24h"]?.isPaidBoost ?? false);
  const [busySnapshot, setBusySnapshot] = useState(false);
  const [snapshotMessage, setSnapshotMessage] = useState("");
  const [busyMeta, setBusyMeta] = useState(false);
  const [metaMessage, setMetaMessage] = useState("");

  const current = snapshots[activeStage];

  function selectStage(stage: SnapshotStage) {
    setActiveStage(stage);
    setPaid(snapshots[stage]?.isPaidBoost ?? false);
    setSnapshotMessage("");
  }

  async function submitSnapshot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusySnapshot(true);
    setSnapshotMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/ig-growth/reels/${reel.id}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: activeStage,
          views: num(form.get("views")),
          reach: num(form.get("reach")),
          likes: num(form.get("likes")),
          comments: num(form.get("comments")),
          shares: num(form.get("shares")),
          saves: num(form.get("saves")),
          follows: num(form.get("follows")),
          profileVisits: num(form.get("profileVisits")),
          avgWatchTimeSec: num(form.get("avgWatchTimeSec")),
          nonFollowerPct: num(form.get("nonFollowerPct")),
          reelsTabPct: num(form.get("reelsTabPct")),
          explorePct: num(form.get("explorePct")),
          feedPct: num(form.get("feedPct")),
          storiesPct: num(form.get("storiesPct")),
          isPaidBoost: paid,
          adSpend: paid ? num(form.get("adSpend")) : null,
          paidViews: paid ? num(form.get("paidViews")) : null,
          paidReach: paid ? num(form.get("paidReach")) : null,
          paidProfileVisits: paid ? num(form.get("paidProfileVisits")) : null,
          paidFollowers: paid ? num(form.get("paidFollowers")) : null
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "儲存失敗");
      setSnapshots((prev) => ({ ...prev, [activeStage]: payload.snapshot }));
      setSnapshotMessage("已儲存");
    } catch (caught) {
      setSnapshotMessage(caught instanceof Error ? caught.message : "儲存失敗");
    } finally {
      setBusySnapshot(false);
    }
  }

  async function submitMeta(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyMeta(true);
    setMetaMessage("");
    const form = new FormData(event.currentTarget);
    const experimentResult = form.get("experimentResult");
    const motherReelType = form.get("motherReelType");
    try {
      const response = await fetch(`/api/ig-growth/reels/${reel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experimentResult: experimentResult || null,
          experimentWhatWorked: form.get("experimentWhatWorked"),
          experimentWhatFailed: form.get("experimentWhatFailed"),
          experimentShouldRepeat: form.get("experimentShouldRepeat"),
          experimentShouldChange: form.get("experimentShouldChange"),
          motherReelType: motherReelType || null,
          dnaNotes: form.get("dnaNotes")
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "儲存失敗");
      setReel(payload.reel);
      setMetaMessage("已儲存");
    } catch (caught) {
      setMetaMessage(caught instanceof Error ? caught.message : "儲存失敗");
    } finally {
      setBusyMeta(false);
    }
  }

  return (
    <main className="admin-shell">
      <div className="admin-heading">
        <div>
          <h1>{reel.title}</h1>
          <p>
            {reel.publishedDate} · {reel.series || "無系列"}
            {reel.episode ? ` · ${reel.episode}` : ""}
          </p>
        </div>
      </div>

      <div className="ig-detail-grid">
        <div>
          <div className="ig-panel">
            <h2>數據輸入</h2>
            <div className="ig-stage-tabs">
              {SNAPSHOT_STAGES.map((s) => (
                <button
                  className="ig-stage-tab"
                  data-active={activeStage === s.key}
                  data-filled={Boolean(snapshots[s.key])}
                  key={s.key}
                  onClick={() => selectStage(s.key)}
                  type="button"
                >
                  {s.label}
                  {snapshots[s.key] ? " ✓" : ""}
                </button>
              ))}
            </div>

            <form className="field-grid" key={activeStage} onSubmit={submitSnapshot}>
              <div className="field">
                <label htmlFor="views">Views</label>
                <input defaultValue={current?.views ?? ""} id="views" name="views" step="any" type="number" />
              </div>
              <div className="field">
                <label htmlFor="reach">Reach</label>
                <input defaultValue={current?.reach ?? ""} id="reach" name="reach" step="any" type="number" />
              </div>
              <div className="field">
                <label htmlFor="likes">Likes</label>
                <input defaultValue={current?.likes ?? ""} id="likes" name="likes" step="any" type="number" />
              </div>
              <div className="field">
                <label htmlFor="comments">Comments</label>
                <input defaultValue={current?.comments ?? ""} id="comments" name="comments" step="any" type="number" />
              </div>
              <div className="field">
                <label htmlFor="shares">Shares</label>
                <input defaultValue={current?.shares ?? ""} id="shares" name="shares" step="any" type="number" />
              </div>
              <div className="field">
                <label htmlFor="saves">Saves</label>
                <input defaultValue={current?.saves ?? ""} id="saves" name="saves" step="any" type="number" />
              </div>
              <div className="field">
                <label htmlFor="follows">Follows</label>
                <input defaultValue={current?.follows ?? ""} id="follows" name="follows" step="any" type="number" />
              </div>
              <div className="field">
                <label htmlFor="profileVisits">Profile Visits</label>
                <input
                  defaultValue={current?.profileVisits ?? ""}
                  id="profileVisits"
                  name="profileVisits"
                  step="any"
                  type="number"
                />
              </div>
              <div className="field">
                <label htmlFor="avgWatchTimeSec">Average Watch Time（秒）</label>
                <input
                  defaultValue={current?.avgWatchTimeSec ?? ""}
                  id="avgWatchTimeSec"
                  name="avgWatchTimeSec"
                  step="any"
                  type="number"
                />
              </div>
              <div className="field">
                <label htmlFor="nonFollowerPct">Non-follower %</label>
                <input
                  defaultValue={current?.nonFollowerPct ?? ""}
                  id="nonFollowerPct"
                  name="nonFollowerPct"
                  step="any"
                  type="number"
                />
              </div>
              <div className="field">
                <label htmlFor="reelsTabPct">Reels Tab %</label>
                <input
                  defaultValue={current?.reelsTabPct ?? ""}
                  id="reelsTabPct"
                  name="reelsTabPct"
                  step="any"
                  type="number"
                />
              </div>
              <div className="field">
                <label htmlFor="explorePct">Explore %</label>
                <input
                  defaultValue={current?.explorePct ?? ""}
                  id="explorePct"
                  name="explorePct"
                  step="any"
                  type="number"
                />
              </div>
              <div className="field">
                <label htmlFor="feedPct">Feed %</label>
                <input defaultValue={current?.feedPct ?? ""} id="feedPct" name="feedPct" step="any" type="number" />
              </div>
              <div className="field">
                <label htmlFor="storiesPct">Stories %</label>
                <input
                  defaultValue={current?.storiesPct ?? ""}
                  id="storiesPct"
                  name="storiesPct"
                  step="any"
                  type="number"
                />
              </div>

              <div className="field full ig-paid-toggle">
                <label>
                  <input checked={paid} onChange={(event) => setPaid(event.target.checked)} type="checkbox" /> 這個階段有
                  Paid Boost
                </label>
              </div>

              {paid ? (
                <>
                  <div className="field">
                    <label htmlFor="adSpend">Ad Spend</label>
                    <input defaultValue={current?.adSpend ?? ""} id="adSpend" name="adSpend" step="any" type="number" />
                  </div>
                  <div className="field">
                    <label htmlFor="paidViews">Paid Views</label>
                    <input
                      defaultValue={current?.paidViews ?? ""}
                      id="paidViews"
                      name="paidViews"
                      step="any"
                      type="number"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="paidReach">Paid Reach</label>
                    <input
                      defaultValue={current?.paidReach ?? ""}
                      id="paidReach"
                      name="paidReach"
                      step="any"
                      type="number"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="paidProfileVisits">Paid Profile Visits</label>
                    <input
                      defaultValue={current?.paidProfileVisits ?? ""}
                      id="paidProfileVisits"
                      name="paidProfileVisits"
                      step="any"
                      type="number"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="paidFollowers">Paid Followers</label>
                    <input
                      defaultValue={current?.paidFollowers ?? ""}
                      id="paidFollowers"
                      name="paidFollowers"
                      step="any"
                      type="number"
                    />
                  </div>
                </>
              ) : null}

              {snapshotMessage ? (
                <div className={snapshotMessage === "已儲存" ? "form-success" : "form-error"}>{snapshotMessage}</div>
              ) : null}
              <div className="field full">
                <button className="button" disabled={busySnapshot} type="submit">
                  {busySnapshot ? "儲存中..." : `儲存 ${activeStage.toUpperCase()} 數據`}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div>
          <div className="ig-panel">
            <h2>Reel 設定</h2>
            <div style={{ color: "#9fb0c7", fontSize: 13, lineHeight: 1.8 }}>
              <div>Content Engine：{ENGINE_LABEL[reel.contentEngine]}</div>
              <div>Primary Mission：{MISSION_LABEL[reel.primaryMission]}</div>
              {reel.secondaryMission ? <div>Secondary Mission：{MISSION_LABEL[reel.secondaryMission]}</div> : null}
              {reel.hook ? <div>Hook：{reel.hook}</div> : null}
              {reel.coverText ? <div>封面文字：{reel.coverText}</div> : null}
              {reel.captionCta ? <div>Caption CTA：{reel.captionCta}</div> : null}
              {reel.videoLengthSec ? <div>影片長度：{reel.videoLengthSec} 秒</div> : null}
              {reel.reelUrl ? (
                <div>
                  <a href={reel.reelUrl} rel="noreferrer" style={{ color: "var(--gold-400)" }} target="_blank">
                    開啟 Reel →
                  </a>
                </div>
              ) : null}
              {reel.experimentHypothesis ? <div style={{ marginTop: 8 }}>Hypothesis：{reel.experimentHypothesis}</div> : null}
            </div>
          </div>

          <div className="ig-panel">
            <h2>Experiment 結果 ＆ Content DNA</h2>
            <form className="field-grid" onSubmit={submitMeta}>
              <div className="field">
                <label htmlFor="experimentResult">Result</label>
                <select defaultValue={reel.experimentResult ?? ""} id="experimentResult" name="experimentResult">
                  <option value="">（尚未判斷）</option>
                  {EXPERIMENT_RESULTS.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="motherReelType">Mother Reel 標記</label>
                <select defaultValue={reel.motherReelType ?? ""} id="motherReelType" name="motherReelType">
                  <option value="">（無）</option>
                  {MOTHER_REEL_TYPES.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field full">
                <label htmlFor="experimentWhatWorked">What Worked?</label>
                <textarea defaultValue={reel.experimentWhatWorked} id="experimentWhatWorked" name="experimentWhatWorked" />
              </div>
              <div className="field full">
                <label htmlFor="experimentWhatFailed">What Failed?</label>
                <textarea defaultValue={reel.experimentWhatFailed} id="experimentWhatFailed" name="experimentWhatFailed" />
              </div>
              <div className="field full">
                <label htmlFor="experimentShouldRepeat">What Should Repeat?</label>
                <textarea
                  defaultValue={reel.experimentShouldRepeat}
                  id="experimentShouldRepeat"
                  name="experimentShouldRepeat"
                />
              </div>
              <div className="field full">
                <label htmlFor="experimentShouldChange">What Should Change?</label>
                <textarea
                  defaultValue={reel.experimentShouldChange}
                  id="experimentShouldChange"
                  name="experimentShouldChange"
                />
              </div>
              <div className="field full">
                <label htmlFor="dnaNotes">DNA Notes（Hook／Story／Visual Pattern／Reusable Elements／Next Experiment）</label>
                <textarea defaultValue={reel.dnaNotes} id="dnaNotes" name="dnaNotes" />
              </div>
              {metaMessage ? (
                <div className={metaMessage === "已儲存" ? "form-success" : "form-error"}>{metaMessage}</div>
              ) : null}
              <div className="field full">
                <button className="button" disabled={busyMeta} type="submit">
                  {busyMeta ? "儲存中..." : "儲存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
