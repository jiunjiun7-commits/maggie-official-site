"use client";

import Image from "next/image";
import { useState } from "react";

export type Review = {
  /** 圖片路徑，放在 public/site/reviews/ 底下 */
  src: string;
  /** 這則回饋的簡短說明，也是圖片的替代文字（給看不到圖的人與 Google 讀） */
  caption: string;
};

/**
 * 客戶 LINE 回饋截圖的自動輪播。
 *
 * - 無限循環：把清單複製一份接在後面，跑完剛好接回起點，看起來不會斷。
 * - 滑鼠移上去或鍵盤聚焦時暫停，讓人有時間看內容。
 * - 點圖可放大細看。
 * - 使用者若偏好減少動態效果，改成可手動左右捲動，不自動跑。
 * - 沒有任何截圖時整區不顯示，避免對外出現空框。
 */
export default function ReviewMarquee({ reviews }: { reviews: Review[] }) {
  const [zoomed, setZoomed] = useState<Review | null>(null);

  if (!reviews.length) return null;

  // 數量太少時多複製幾輪，才不會出現空白斷點
  const repeat = reviews.length < 4 ? 3 : 2;
  const loop = Array.from({ length: repeat }, () => reviews).flat();

  return (
    <>
      <div className="marquee" aria-roledescription="carousel">
        <ul className="marquee__track" style={{ "--count": loop.length } as React.CSSProperties}>
          {loop.map((review, index) => (
            <li className="marquee__item" key={`${review.src}-${index}`}>
              <button
                type="button"
                className="marquee__shot"
                onClick={() => setZoomed(review)}
                aria-label={`放大檢視：${review.caption}`}
              >
                <Image
                  src={review.src}
                  alt={review.caption}
                  width={420}
                  height={760}
                  sizes="(max-width: 700px) 60vw, 240px"
                  // 第一輪之外的都是視覺重複，不需要讓輔助技術重複朗讀
                  aria-hidden={index >= reviews.length}
                />
              </button>
              <p className="marquee__caption">{review.caption}</p>
            </li>
          ))}
        </ul>
      </div>

      {zoomed ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={zoomed.caption}
          onClick={() => setZoomed(null)}
        >
          <button type="button" className="lightbox__close" aria-label="關閉">×</button>
          <Image
            src={zoomed.src}
            alt={zoomed.caption}
            width={840}
            height={1520}
            sizes="90vw"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
