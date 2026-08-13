"use client";

import { useState } from "react";
import Link from "next/link";
import type { ChallengeDashboard } from "@/lib/ig-challenge-store";

function formatInt(value: number) {
  return Math.round(value).toLocaleString("zh-TW");
}

function formatSigned(value: number) {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded.toLocaleString("zh-TW")}` : rounded.toLocaleString("zh-TW");
}

function formatPct(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export default function IgGrowthBoard({ initialDashboard }: { initialDashboard: ChallengeDashboard | null }) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (!dashboard) {
    return (
      <main className="admin-shell">
        <div className="admin-heading">
          <div>
            <h1>Maggie 90 天 IG 10K Growth Lab</h1>
            <p>尚未設定 Challenge。請先在 Supabase SQL Editor 執行 supabase/schema.sql（已內建 Day 0 設定與初始 Reel 資料）。</p>
          </div>
        </div>
      </main>
    );
  }

  const { challenge } = dashboard;

  async function submitFollowers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/ig-growth/followers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followers: Number(form.get("followers")) })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "儲存失敗");
      setDashboard(payload.dashboard);
      setShowForm(false);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "儲存失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-shell">
      <div className="admin-heading">
        <div>
          <h1>Maggie 90 天 IG 10K Growth Lab</h1>
          <p>
            {challenge.account} · 漲粉作戰中心 · Day 0：{challenge.day0Date}（{formatInt(challenge.day0Followers)} 人）
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="button" onClick={() => setShowForm((v) => !v)} type="button">
            {showForm ? "取消" : "＋ 今日數據"}
          </button>
          <Link className="button-secondary" href="/admin/ig-growth/reels">
            Reels 資料庫 →
          </Link>
        </div>
      </div>

      {showForm ? (
        <form className="ig-quick-form" onSubmit={submitFollowers}>
          <div className="field">
            <label htmlFor="followers">今天的目前 Followers</label>
            <input
              defaultValue={dashboard.currentFollowers}
              id="followers"
              inputMode="numeric"
              min={0}
              name="followers"
              required
              type="number"
            />
          </div>
          {message ? <div className="form-error">{message}</div> : null}
          <button className="button" disabled={busy} type="submit">
            {busy ? "儲存中..." : "儲存今日粉絲數"}
          </button>
        </form>
      ) : null}

      <div className="ig-stat-grid">
        <div className="stat">
          <div className="stat-label">目前進度</div>
          <div className="stat-value">
            Day {dashboard.currentDay} / {challenge.challengeDays}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">目前 Followers</div>
          <div className="stat-value">{formatInt(dashboard.currentFollowers)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">累積新增 Followers</div>
          <div className="stat-value">{formatSigned(dashboard.netGrowth)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">距離 10K 還差</div>
          <div className="stat-value">{formatInt(Math.max(0, dashboard.remainingToTarget))}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Challenge 完成率</div>
          <div className="stat-value">{formatPct(dashboard.completionRate)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">剩餘天數</div>
          <div className="stat-value">{dashboard.daysRemaining}</div>
        </div>
        <div className="stat">
          <div className="stat-label">過去 7 日新增</div>
          <div className="stat-value">{formatSigned(dashboard.last7dGrowth)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">平均每日新增</div>
          <div className="stat-value">{dashboard.avgDailyGrowthRecent.toFixed(1)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">需要的平均每日新增</div>
          <div className="stat-value">
            {dashboard.neededAvgDailyGrowth === null ? "—" : dashboard.neededAvgDailyGrowth.toFixed(1)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">目前 Pace</div>
          <div className="stat-value">
            {dashboard.onPace === null ? "—" : dashboard.onPace ? "✅ 足以達標" : "⚠️ 落後"}
          </div>
        </div>
      </div>

      <p className="ig-updated-note">粉絲數更新於：{dashboard.currentFollowersDate}</p>
    </main>
  );
}
