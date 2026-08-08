"use client";

import { useState } from "react";
import type { SocialQr } from "@/lib/social-qr";

export default function SocialQrDock({ items }: { items: SocialQr[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  if (!items.length) return null;

  return (
    <div className="qrdock" aria-label="社群與 LINE 諮詢 QR Code">
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
            onClick={() => setOpenKey((current) => (current === item.key ? null : item.key))}
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
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3C6.99 3 3 6.36 3 10.5c0 3.4 2.66 6.27 6.32 7.24-.28 1.02-1 3.7-1.15 4.27-.19.7.26.69.54.5.22-.15 3.5-2.36 4.92-3.32.44.06.9.09 1.37.09 5.01 0 9-3.36 9-7.5S17.01 3 12 3Z"
          fill="currentColor"
        />
      </svg>
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
