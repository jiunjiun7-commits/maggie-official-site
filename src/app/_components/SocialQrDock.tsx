"use client";

import { useEffect, useRef, useState } from "react";
import type { SocialQr } from "@/lib/social-qr";

export default function SocialQrDock({ items }: { items: SocialQr[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // 滑鼠使用者 hover 就會先開啟面板，如果點擊只是單純「切換開關」，
  // 點下去的瞬間會被判定成「已經開著→關掉」，面板等於沒打開就消失了。
  // 改成點擊一律「開」，只靠滑鼠移開、點外面或 Esc 來關閉。
  useEffect(() => {
    if (!openKey) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenKey(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenKey(null);
    };
    document.addEventListener("click", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openKey]);

  if (!items.length) return null;

  return (
    <div className="qrdock" aria-label="社群與 LINE 諮詢 QR Code" ref={rootRef}>
      {items.map((item) => (
        <div
          key={item.key}
          className="qrdock__item"
          onMouseEnter={() => setOpenKey(item.key)}
          onMouseLeave={() => setOpenKey((current) => (current === item.key ? null : current))}
        >
          <button
            type="button"
            className={`qrdock__toggle qrdock__toggle--${item.key}`}
            aria-expanded={openKey === item.key}
            onClick={() => setOpenKey(item.key)}
          >
            <QrDockIcon type={item.key} />
            <span className="sr-only">{item.label} QR Code</span>
          </button>

          {openKey === item.key && (
            <div className="qrdock__panel" role="dialog" aria-label={`${item.label} QR Code`}>
              <div className="qrdock__qr" dangerouslySetInnerHTML={{ __html: item.svg }} />
              <p className="qrdock__label">{item.label}</p>
              <a className="qrdock__link" href={item.url} target="_blank" rel="noopener noreferrer">
                開啟連結
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function QrDockIcon({ type }: { type: SocialQr["key"] }) {
  if (type === "line") {
    return (
      <span className="qrdock__linemark" aria-hidden="true">
        LINE
      </span>
    );
  }
  if (type === "instagram") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 9V6.8c0-.7.4-1.1 1.1-1.1H17V2h-2.6C11.9 2 10.4 3.6 10.4 6.4V9H8v3.4h2.4V22H14v-9.6h2.6l.4-3.4H14Z"
        fill="currentColor"
      />
    </svg>
  );
}
