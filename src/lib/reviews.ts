import type { Review } from "@/app/_components/ReviewMarquee";

/**
 * 客戶 LINE 回饋截圖。
 *
 * 加法：
 *   1. 把截圖放進 public/site/reviews/（檔名用英文小寫，例如 review-01.jpg）
 *   2. 在下面的陣列加一筆，caption 寫這則回饋在講什麼
 *
 * ⚠️ 上架前務必先遮掉：客戶姓名、大頭貼、電話、地址、門牌、社區名稱。
 *    也要先取得客戶同意才公開對話內容。
 *
 * 陣列是空的時候，整個輪播區塊不會出現在網站上。
 */
export const REVIEWS: Review[] = [
  // { src: "/site/reviews/review-01.jpg", caption: "美術館特區換屋客戶：成交後回頭感謝事前的稅務提醒" },
  // { src: "/site/reviews/review-02.jpg", caption: "農十六屋主：從委託到成交的溝通過程" },
];
