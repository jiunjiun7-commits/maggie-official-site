/**
 * 擋民國年誤植成西元年的輸入（例如「115」被當成西元 115 年存進 date 欄位）。
 * 這個 app 服務的都是近年的委託案件，年份合理範圍抓 2000 年以後，
 * 抓到就代表使用者直接打字輸入年份、沒有用日期選擇器點選。
 */
export function isImplausibleYear(dateStr: string): boolean {
  if (!dateStr) return false;
  const year = Number(dateStr.slice(0, 4));
  return Number.isFinite(year) && year < 2000;
}

export const IMPLAUSIBLE_YEAR_MESSAGE =
  "日期年份看起來不對（可能打成民國年了，例如「115」）。請用日期選擇器點選，不要直接打字輸入年份。";
