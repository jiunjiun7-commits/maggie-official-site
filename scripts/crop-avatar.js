/**
 * 從全身棚拍照裁出「頭到胸口」的正方形大頭貼。
 *
 *   node scripts/crop-avatar.js
 *
 * 換照片或想調整取景時，改下面三個參數再跑一次即可。
 */
const sharp = require("sharp");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "public/site/img/profile.jpg");
const OUT = path.join(ROOT, "public/card/maggie-avatar.jpg");

// 可調參數（比例，相對於原圖）
const CENTER_X = 0.51; // 人物水平中心：0 最左、1 最右
const TOP = 0.12;      // 從圖片頂端往下多少開始裁
const SIZE = 0.5;      // 正方形邊長佔原圖「寬度」的比例；數字越小裁得越近

(async () => {
  const meta = await sharp(SRC).metadata();
  const { width: w, height: h } = meta;

  const side = Math.round(w * SIZE);
  const left = Math.max(0, Math.min(Math.round(w * CENTER_X - side / 2), w - side));
  const top = Math.max(0, Math.min(Math.round(h * TOP), h - side));

  await sharp(SRC)
    .extract({ left, top, width: side, height: side })
    .resize(600, 600, { fit: "cover" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(OUT);

  console.log(`原圖 ${w}x${h}`);
  console.log(`裁切 left=${left} top=${top} size=${side}`);
  console.log(`輸出 ${path.relative(ROOT, OUT)}`);
})();
