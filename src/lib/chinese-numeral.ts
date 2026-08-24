/**
 * 內政部實價登錄的樓層欄位是中文數字（例："九層"、"十四層"），這裡只處理
 * 「單一、乾淨的樓層數字＋層」這種格式，轉成阿拉伯數字。
 *
 * 刻意保守：地下樓層（"地下一層"）、多樓層合併（"一層，二層"）、空值、格式看不懂的，
 * 一律回傳 null，不猜測——呼叫端看到 null 就不要顯示樓層資訊，不要顯示錯的。
 */
const DIGITS: Record<string, number> = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const UNITS: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };

function chineseToNumber(text: string): number | null {
  if (!text || !/^[零一二三四五六七八九十百千]+$/.test(text)) return null;
  let total = 0;
  let section = 0;
  let current = 0;
  for (const ch of text) {
    if (ch in DIGITS) {
      current = DIGITS[ch];
    } else {
      const unit = UNITS[ch];
      section += (current === 0 ? 1 : current) * unit;
      current = 0;
    }
  }
  total = section + current;
  return total;
}

/** "九層" → 9；"地下一層"、"一層，二層"、空字串 → null（不猜測，交給呼叫端決定不顯示）。 */
export function parseChineseFloorLabel(raw: string | null | undefined): number | null {
  const text = (raw ?? "").trim();
  if (!text || !text.endsWith("層") || text.includes("地下") || text.includes("，") || text.includes(",")) return null;
  return chineseToNumber(text.slice(0, -1));
}
