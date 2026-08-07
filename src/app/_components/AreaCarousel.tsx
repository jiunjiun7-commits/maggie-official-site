"use client";

import { useEffect, useRef } from "react";

/** 淡金色的定位圖釘，取代表情符號，維持整站的黑金極簡調性 */
function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M12 2c-4.14 0-7.5 3.36-7.5 7.5 0 5.63 6.63 12 7.06 12.4a.6.6 0 0 0 .88 0c.43-.4 7.06-6.77 7.06-12.4C19.5 5.36 16.14 2 12 2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="9.5" r="2.6" fill="currentColor" />
    </svg>
  );
}

export type Area = { name: string; tag: string };

/**
 * 服務區域的橫向浮動輪播：預設緩慢自動捲動，滑鼠移上／鍵盤聚焦時暫停，
 * 也可以用左右箭頭手動翻頁。
 *
 * 用 rAF 直接控制 transform，而不是 CSS animation，
 * 是為了讓箭頭點擊可以和自動捲動共用同一個位置狀態，不會互相打架。
 */
export default function AreaCarousel({ areas }: { areas: Area[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const offset = useRef(0);
  const paused = useRef(false);
  const itemWidth = useRef(0);
  const setWidth = useRef(0);

  // 自動捲動要無縫循環，所以清單重複兩份
  const loop = [...areas, ...areas];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const measure = () => {
      const firstItem = track.children[0] as HTMLElement | undefined;
      const gap = parseFloat(getComputedStyle(track).columnGap || "0");
      itemWidth.current = (firstItem?.offsetWidth || 0) + gap;
      setWidth.current = itemWidth.current * areas.length;
    };
    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(track);

    let frame = 0;
    const speed = 0.45; // px / frame，慢速漂浮感

    const tick = () => {
      if (!paused.current && !reduceMotion && setWidth.current > 0) {
        offset.current += speed;
        if (offset.current >= setWidth.current) offset.current -= setWidth.current;
        track.style.transform = `translateX(${-offset.current}px)`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [areas.length]);

  const nudge = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track || setWidth.current <= 0) return;
    offset.current += direction * itemWidth.current;
    if (offset.current < 0) offset.current += setWidth.current;
    if (offset.current >= setWidth.current) offset.current -= setWidth.current;
    track.style.transition = "transform .45s cubic-bezier(.22,.61,.36,1)";
    track.style.transform = `translateX(${-offset.current}px)`;
    window.setTimeout(() => {
      if (track) track.style.transition = "";
    }, 460);
  };

  return (
    <div
      className="area-carousel"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
    >
      <button
        type="button"
        className="area-carousel__arrow area-carousel__arrow--prev"
        aria-label="上一個區域"
        onClick={() => nudge(-1)}
      >
        ‹
      </button>

      <div className="area-carousel__viewport">
        <ul className="area-carousel__track" ref={trackRef}>
          {loop.map((area, index) => (
            <li
              className="area-carousel__chip"
              key={`${area.name}-${index}`}
              aria-hidden={index >= areas.length}
            >
              <span className="area-carousel__pin"><PinIcon /></span>
              <span className="area-carousel__text">
                <span className="area-carousel__name">{area.name}</span>
                <span className="area-carousel__desc">{area.tag}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        className="area-carousel__arrow area-carousel__arrow--next"
        aria-label="下一個區域"
        onClick={() => nudge(1)}
      >
        ›
      </button>
    </div>
  );
}
