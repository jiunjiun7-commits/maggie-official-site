"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** 最終要跑到的數字 */
  to: number;
  /** 小數位數 */
  decimals?: number;
  /** 動畫長度（毫秒） */
  duration?: number;
};

/**
 * 捲到畫面內才開始跑的數字動畫。
 * 只跑一次，跑完停在最終值；使用者若偏好減少動態效果則直接顯示結果。
 *
 * 注意：「是否已啟動」用 ref 不用 state —— 若放進 effect 依賴，
 * 狀態一變就會觸發 cleanup 把 requestAnimationFrame 取消掉，數字會停在 0。
 */
export default function CountUp({ to, decimals = 0, duration = 1600 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      setValue(to);
      return;
    }

    let frame = 0;

    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        // easeOutExpo：一開始衝很快，結尾慢慢收，比線性有力道
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        setValue(to * eased);
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || started.current) return;
        started.current = true;
        observer.disconnect();
        run();
      },
      { threshold: 0.4 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [to, duration]);

  return <span ref={ref}>{value.toFixed(decimals)}</span>;
}
