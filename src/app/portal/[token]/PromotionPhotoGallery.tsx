"use client";

import { useState } from "react";
import type { PromotionPhoto } from "@/lib/seller-report-store";

/** 沒有照片時，呼叫端根本不會渲染這個元件——標題跟區塊在 ReportBody 那邊就整段略過了。 */
export default function PromotionPhotoGallery({ photos }: { photos: PromotionPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <div className="portal-photo-grid">
        {photos.map((photo, index) => (
          <button
            className="portal-photo-thumb"
            key={photo.url}
            onClick={() => setOpenIndex(index)}
            type="button"
          >
            <img alt={photo.caption || "推廣紀錄照片"} src={photo.url} />
            {photo.caption ? <span>{photo.caption}</span> : null}
          </button>
        ))}
      </div>

      {openIndex !== null ? (
        <div className="portal-lightbox" onClick={() => setOpenIndex(null)}>
          <button className="portal-lightbox-close" onClick={() => setOpenIndex(null)} type="button">
            ✕
          </button>
          <img alt={photos[openIndex].caption || "推廣紀錄照片"} src={photos[openIndex].url} />
          {photos[openIndex].caption ? <p>{photos[openIndex].caption}</p> : null}
        </div>
      ) : null}
    </>
  );
}
