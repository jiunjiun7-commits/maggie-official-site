import type { Review } from "@/app/_components/ReviewMarquee";

/**
 * 客戶 LINE 回饋截圖。
 *
 * 加法：
 *   1. 把截圖放進 public/site/reviews/（檔名用英文或中文短說明都可以）
 *   2. 量出圖片真實的寬高（一定要量，聊天截圖比例落差很大，
 *      隨便填會被壓扁或拉長）：
 *
 *        node -e "require('sharp')('public/site/reviews/檔名.jpg').metadata().then(m=>console.log(m.width,m.height))"
 *
 *   3. 在下面的陣列加一筆，caption 寫這則回饋在講什麼
 *
 * ⚠️ 上架前務必先遮掉：客戶姓名、大頭貼、電話、地址、門牌、社區名稱。
 *    也要先取得客戶同意才公開對話內容。
 *
 * 陣列是空的時候，整個輪播區塊不會出現在網站上。
 */
export const REVIEWS: Review[] = [
  {
    src: "/site/reviews/review01客戶比較多家仲介後選擇合作.jpg",
    caption: "客戶比較多家仲介後選擇合作",
    width: 1260,
    height: 302
  },
  {
    src: "/site/reviews/review02成交後的感謝訊息.jpg",
    caption: "成交後的感謝訊息",
    width: 1260,
    height: 573
  },
  {
    src: "/site/reviews/review03客戶主動推薦家人跟我合作.jpg",
    caption: "客戶主動推薦家人跟我合作",
    width: 860,
    height: 294
  },
  {
    src: "/site/reviews/review04客戶首購的心情感謝訊息.jpg",
    caption: "客戶首購的心情感謝訊息",
    width: 860,
    height: 200
  },
  {
    src: "/site/reviews/review05客戶看屋後的滿意服務度.jpg",
    caption: "客戶看屋後的滿意服務度",
    width: 1260,
    height: 716
  },
  {
    src: "/site/reviews/review06與客戶之前長期關係的建立.jpg",
    caption: "與客戶長期關係的建立",
    width: 860,
    height: 394
  }
];
