"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Milestone } from "@/lib/milestones";

const INTERVAL = 5000;
const FADE = 600;

/**
 * 專業歷程卡片：卡片外框完全固定，只有內容淡出 → 更新 → 淡入。
 *
 * 自動播放與手動點擊共用同一支 fade timer（fadeTimer），
 * 每次切換前一定先清掉前一支，否則兩邊的 timer 會互相覆蓋，
 * 造成內容永遠停在淡出狀態。
 * 目前索引另外用 ref 同步，讓 interval 讀得到最新值而不必重建。
 */
export default function MilestoneCard({ milestones }: { milestones: Milestone[] }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  const indexRef = useRef(0);
  const fadeTimer = useRef<number | null>(null);
  const paused = useRef(false);
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback(
    (next: number) => {
      const total = milestones.length;
      const target = ((next % total) + total) % total;
      if (target === indexRef.current) return;

      if (fadeTimer.current !== null) window.clearTimeout(fadeTimer.current);
      setVisible(false);
      fadeTimer.current = window.setTimeout(() => {
        indexRef.current = target;
        setIndex(target);
        setVisible(true);
        fadeTimer.current = null;
      }, FADE);
    },
    [milestones.length]
  );

  useEffect(() => {
    if (milestones.length <= 1) return;
    const timer = window.setInterval(() => {
      if (paused.current) return;
      goTo(indexRef.current + 1);
    }, INTERVAL);
    return () => {
      window.clearInterval(timer);
      if (fadeTimer.current !== null) window.clearTimeout(fadeTimer.current);
    };
  }, [goTo, milestones.length]);

  const current = milestones[index];

  return (
    <div
      className="stat milestone"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onTouchStart={(event) => {
        paused.current = true;
        touchStartX.current = event.touches[0].clientX;
      }}
      onTouchEnd={(event) => {
        paused.current = false;
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start === null) return;
        const delta = event.changedTouches[0].clientX - start;
        if (Math.abs(delta) < 40) return;
        goTo(indexRef.current + (delta < 0 ? 1 : -1));
      }}
    >
      <div className="milestone__head">
        <span className="milestone__eyebrow">Professional Milestones</span>
        <span className="milestone__title">專業歷程</span>
      </div>

      <div
        className={`milestone__body${visible ? " is-visible" : ""}`}
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="milestone__meta">
          <span className="milestone__icon" aria-hidden="true">{current.icon}</span>
          <span className="milestone__date">{current.date}</span>
          <span className="milestone__company">{current.company}</span>
        </div>
        <div className="milestone__award">{current.title}</div>
        <p className="milestone__desc">{current.description}</p>
      </div>

      <div className="milestone__dots" role="tablist" aria-label="專業歷程切換">
        {milestones.map((milestone, dotIndex) => (
          <button
            key={`${milestone.date}-${milestone.title}`}
            type="button"
            role="tab"
            className={`milestone__dot${dotIndex === index ? " is-active" : ""}`}
            aria-selected={dotIndex === index}
            aria-label={`${milestone.date} ${milestone.title}`}
            onClick={() => goTo(dotIndex)}
          />
        ))}
      </div>
    </div>
  );
}
