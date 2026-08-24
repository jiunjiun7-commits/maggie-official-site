/**
 * 高雄一般門牌 Geocoding 解析器 MVP。
 * 組合順序：地址正規化 → 高雄市政府門牌坐標索引比對 → TWD97→WGS84 座標轉換。
 *
 * match_status / match_method 定義（不可為了衝高成功率而混淆等級）：
 *   - exact：地址正規化後的路／巷／弄／號，跟資料集裡的門牌完全相符。
 *   - normalized：門牌號要素相同，只是「之」「-」等分隔符號寫法不同才需要正規化才比對得到
 *                （例：地址「20-4號」對到資料集「20之4」），座標仍是該門牌本身、非鄰近門牌。
 *   - approximate：同路段／巷／弄查得到資料，但查無完全相符的門牌號，改用鄰近門牌號的
 *                座標近似代表；lat/lng 一定會標明是哪一個門牌號的座標，不可冒充成精確門牌。
 *   - unmatched：查無同路段／巷／弄的任何門牌資料，或鄰近門牌號差距過大不適合近似。
 */
const { normalizeAddress } = require("./normalize-address");
const { twd97ToWgs84 } = require("./twd97");

const APPROXIMATE_MAX_DELTA = 6; // 鄰近門牌號差距上限，超過就不近似，避免亂猜

function houseNumBase(houseNum) {
  const m = houseNum.match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

function houseNumVariants(houseNum) {
  const variants = new Set([houseNum]);
  if (houseNum.includes("之")) {
    variants.add(houseNum.replace("之", "-"));
    variants.add(houseNum.replace(/之\d+$/, ""));
  }
  return [...variants];
}

function findApproximate(group, houseNum) {
  const targetBase = houseNumBase(houseNum);
  if (targetBase === null) return null;

  let best = null;
  for (const [candidateHouseNum, coord] of group.entries()) {
    const candidateBase = houseNumBase(candidateHouseNum);
    if (candidateBase === null) continue;
    const delta = Math.abs(candidateBase - targetBase);
    if (delta > APPROXIMATE_MAX_DELTA) continue;
    if (!best || delta < best.delta) best = { delta, houseNum: candidateHouseNum, coord };
  }
  return best;
}

/**
 * @param {string} rawAddress
 * @param {string} district
 * @param {Map} index 由 buildAddressIndex 產生的索引
 */
function resolveAddress(rawAddress, district, index) {
  const parsed = normalizeAddress(rawAddress, district);
  if (!parsed.ok) {
    return { ok: false, match_status: "unmatched", match_method: "parse_failed", reason: parsed.reason };
  }

  const groupKey = `${parsed.road}|${parsed.lane}|${parsed.alley}`;
  const group = index.get(groupKey);

  if (!group || group.size === 0) {
    return {
      ok: false,
      match_status: "unmatched",
      match_method: "no_road_segment",
      parsed,
      reason: `資料集查無「${parsed.road}${parsed.lane ? parsed.lane + "巷" : ""}${parsed.alley ? parsed.alley + "弄" : ""}」的任何門牌資料`
    };
  }

  if (group.has(parsed.houseNum)) {
    const { x, y } = group.get(parsed.houseNum);
    return {
      ok: true,
      match_status: "exact",
      match_method: "exact_house_number",
      parsed,
      matchedHouseNum: parsed.houseNum,
      ...twd97ToWgs84(x, y)
    };
  }

  for (const variant of houseNumVariants(parsed.houseNum)) {
    if (variant === parsed.houseNum) continue;
    if (group.has(variant)) {
      const { x, y } = group.get(variant);
      return {
        ok: true,
        match_status: "normalized",
        match_method: "separator_variant",
        parsed,
        matchedHouseNum: variant,
        reason: `門牌號「${parsed.houseNum}」正規化為「${variant}」後比對成功`,
        ...twd97ToWgs84(x, y)
      };
    }
  }

  const approx = findApproximate(group, parsed.houseNum);
  if (approx) {
    return {
      ok: true,
      match_status: "approximate",
      match_method: "nearby_house_number",
      parsed,
      matchedHouseNum: approx.houseNum,
      reason: `查無門牌「${parsed.houseNum}」，改用同路段鄰近門牌「${approx.houseNum}」座標近似代表（門牌號差距 ${approx.delta}）`,
      ...twd97ToWgs84(approx.coord.x, approx.coord.y)
    };
  }

  return {
    ok: false,
    match_status: "unmatched",
    match_method: "house_number_not_found",
    parsed,
    reason: `同路段／巷弄有資料，但查無門牌「${parsed.houseNum}」或差距 ${APPROXIMATE_MAX_DELTA} 以內的鄰近門牌`
  };
}

module.exports = { resolveAddress, APPROXIMATE_MAX_DELTA };
