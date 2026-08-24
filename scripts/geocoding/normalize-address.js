/**
 * 高雄一般門牌地址正規化。
 *
 * 只處理「一般門牌」（路／街／道／巷＋巷弄號），不處理地號／段地號地址
 * （呼叫端應先用 classifyAddressType 之類的邏輯排除地號地址，這支模組不做判斷）。
 *
 * 設計原則：只做「結構拆解」，不做地理比對、不猜測缺漏欄位。拆不出來就回傳
 * ok:false 附原因，交由呼叫端記為 unmatched，不強行湊出一個看似合理的結果。
 */

const FULLWIDTH_DIGITS = /[０-９]/g;

function toHalfWidth(str) {
  return str
    .replace(FULLWIDTH_DIGITS, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/Ｔ/g, "T")
    .replace(/－/g, "-");
}

/**
 * 路名／巷弄號主要解析規則。
 * 刻意把「巷」也放進路名結尾字元集合，用來處理「路名本身就叫 OO 巷」這種格式
 * （例：民族巷12之3號）；因為 road 群組是 non-greedy，只要字串裡先出現
 * 路／街／道，就會優先在那裡截斷，不會誤把真正的巷弄號吃進路名，經 19 筆
 * 樣本涵蓋的格式驗證過（見 scripts/verify-kcg-resolver.js）。
 *
 * 巷／弄／號都各自允許「N之M」格式（例：218之15巷、20之4號），對應建物門牌的附號，
 * 跟「號之後的樓層／建物代號」（remainder，例：十樓、Ｔ21、十七樓之８）是不同概念，
 * 不可混為一談 —— remainder 一律視為門牌以外的資訊，只保留原文，不參與座標比對。
 */
const ADDRESS_RE = /^(.+?[路街道巷])(?:(\d+(?:之\d+)?)巷)?(?:(\d+(?:之\d+)?)弄)?(\d+(?:之\d+)?)號(.*)$/;

function stripDistrictPrefix(address, district) {
  let s = address.trim();
  if (district && s.startsWith(`高雄市${district}`)) {
    return s.slice(`高雄市${district}`.length);
  }
  // 找不到已知行政區時，退回通用規則去掉「高雄市OO區/鄉/鎮/市」開頭，
  // 不猜測行政區內容，只是把不影響比對的縣市前綴拿掉。
  return s.replace(/^高雄市[^市區鄉鎮]+[市區鄉鎮]/, "");
}

/**
 * @param {string} rawAddress 原始地址字串（可能含全形數字、行政區前綴、樓層資訊）
 * @param {string} [district] 已知行政區（來自資料來源本身的欄位，非猜測）
 * @returns {{ ok: true, district: string, road: string, lane: string, alley: string,
 *             houseNum: string, floorRaw: string, normalizedAddress: string } |
 *           { ok: false, reason: string }}
 */
function normalizeAddress(rawAddress, district) {
  if (!rawAddress || !rawAddress.trim()) {
    return { ok: false, reason: "地址為空" };
  }

  const halfWidth = toHalfWidth(rawAddress.trim());
  const withoutDistrict = stripDistrictPrefix(halfWidth, district);

  const match = withoutDistrict.match(ADDRESS_RE);
  if (!match) {
    return { ok: false, reason: `無法解析出路／巷弄號結構：「${withoutDistrict}」` };
  }

  const [, road, lane, alley, houseNum, remainder] = match;

  return {
    ok: true,
    district: district || "",
    road,
    lane: lane || "",
    alley: alley || "",
    houseNum,
    floorRaw: remainder ? remainder.trim() : "",
    normalizedAddress: withoutDistrict
  };
}

module.exports = { normalizeAddress, toHalfWidth };
