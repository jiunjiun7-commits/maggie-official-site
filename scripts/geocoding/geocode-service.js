/**
 * official_transactions 一般門牌地址 → lat/lng 的正式同步服務。
 *
 * 範圍嚴格限制（這階段刻意不做的事）：
 *   - 不寫 area_id、不呼叫 isPointInPolygon()/isPointInBbox()、不做區域自動分類
 *   - 不處理地號地址，只標記 skipped_land_parcel 直接跳過，不猜座標
 *   - 不觸碰 LINE / Cron
 *
 * 狀態機（official_transactions.geocode_status）：
 *   pending → resolved | failed | skipped_land_parcel | skipped_unparseable_address
 * 只有 pending（或明確要求 force）才會被這支服務處理，已經處理過的列預設不會重跑，
 * 這樣才符合「已有 lat/lng 的資料不要每次重複解析」的要求，也讓一次跑上千筆時
 * 可以安全地分批多次執行、中斷後重跑不會浪費工。
 */
const { classifyAddressType } = require("./classify-address-type");
const { normalizeAddress } = require("./normalize-address");
const { resolveAddress } = require("./resolve-address");
const { ensureCachedCsv, buildAddressIndex } = require("./kcg-source");

const SELECT_COLUMNS = "id, district, address, geocode_status";

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ force?: boolean, limit?: number, csvMaxAgeDays?: number }} [options]
 */
async function syncOfficialTransactionGeocodes(supabase, options = {}) {
  const { force = false, limit = 5000, csvMaxAgeDays } = options;

  let query = supabase.from("official_transactions").select(SELECT_COLUMNS).order("created_at", { ascending: true }).limit(limit);
  if (!force) query = query.eq("geocode_status", "pending");
  const { data: rows, error: fetchError } = await query;
  if (fetchError) throw fetchError;

  const summary = {
    totalFetched: rows.length,
    streetAddress: 0,
    landParcel: 0,
    unknownType: 0,
    resolved: { exact: 0, normalized: 0, approximate: 0 },
    failed: 0,
    skippedLandParcel: 0,
    dbErrors: 0,
    alreadyProcessedSkipped: 0, // 這次呼叫沒有取到、因為已經是終態的筆數，只有非 force 模式才有意義
    details: []
  };

  const classified = rows.map((row) => ({ row, addressType: classifyAddressType(row.address) }));
  for (const c of classified) {
    if (c.addressType === "street_address") summary.streetAddress++;
    else if (c.addressType === "land_parcel") summary.landParcel++;
    else summary.unknownType++;
  }

  // 地號／未知類型不需要 CSV，直接標記，不消耗任何地理編碼資源。
  const nonStreet = classified.filter((c) => c.addressType !== "street_address");
  for (const { row, addressType } of nonStreet) {
    const status = addressType === "land_parcel" ? "skipped_land_parcel" : "skipped_unparseable_address";
    const detail = {
      ok: true,
      status,
      reason: addressType === "land_parcel" ? "地號／段地號地址，這階段不處理座標" : "地址格式無法判斷類型"
    };
    const applied = await applyResult(supabase, row, { geocode_status: status, geocode_match_status: null, geocode_source: null, geocode_detail: detail });
    if (!applied.ok) summary.dbErrors++;
    if (addressType === "land_parcel") summary.skippedLandParcel++;
    summary.details.push({ id: row.id, address: row.address, addressType, geocode_status: status });
  }

  const streetRows = classified.filter((c) => c.addressType === "street_address").map((c) => c.row);

  if (streetRows.length === 0) {
    return summary;
  }

  // 先正規化取得需要的路名集合，CSV 索引只保留這些路名，避免掃過全部 128 萬筆。
  const preParsed = streetRows.map((row) => ({ row, parsed: normalizeAddress(row.address, row.district) }));
  const roadNames = new Set(preParsed.filter((p) => p.parsed.ok).map((p) => p.parsed.road));

  const cacheInfo = await ensureCachedCsv(csvMaxAgeDays ? { maxAgeDays: csvMaxAgeDays } : {});
  summary.csvSource = cacheInfo.source;
  summary.csvCached = cacheInfo.cached;

  const { index } = roadNames.size > 0 ? await buildAddressIndex(cacheInfo.csvPath, roadNames) : { index: new Map() };

  for (const { row } of preParsed) {
    let outcome;
    try {
      outcome = resolveAddress(row.address, row.district, index);
    } catch (err) {
      summary.failed++;
      const detail = { ok: false, reason: `解析器例外：${err instanceof Error ? err.message : String(err)}` };
      const applied = await applyResult(supabase, row, {
        geocode_status: "failed",
        geocode_match_status: null,
        geocode_source: summary.csvSource,
        geocode_detail: detail
      });
      if (!applied.ok) summary.dbErrors++;
      summary.details.push({ id: row.id, address: row.address, addressType: "street_address", geocode_status: "failed", reason: detail.reason });
      continue; // 單筆失敗不可中斷整批，繼續處理下一筆
    }

    if (outcome.ok) {
      summary.resolved[outcome.match_status]++;
      const detail = {
        ok: true,
        matchMethod: outcome.match_method,
        matchedHouseNum: outcome.matchedHouseNum,
        reason: outcome.reason || null
      };
      const applied = await applyResult(supabase, row, {
        lat: outcome.lat,
        lng: outcome.lng,
        geocode_status: "resolved",
        geocode_match_status: outcome.match_status,
        geocode_source: summary.csvSource,
        geocode_detail: detail
      });
      if (!applied.ok) summary.dbErrors++;
      summary.details.push({
        id: row.id,
        address: row.address,
        addressType: "street_address",
        geocode_status: "resolved",
        match_status: outcome.match_status,
        lat: outcome.lat,
        lng: outcome.lng
      });
    } else {
      summary.failed++;
      const detail = { ok: false, matchMethod: outcome.match_method, reason: outcome.reason };
      const applied = await applyResult(supabase, row, {
        geocode_status: "failed",
        geocode_match_status: outcome.match_status,
        geocode_source: summary.csvSource,
        geocode_detail: detail
      });
      if (!applied.ok) summary.dbErrors++;
      summary.details.push({ id: row.id, address: row.address, addressType: "street_address", geocode_status: "failed", reason: outcome.reason });
    }
  }

  return summary;
}

/** 單筆寫入包一層 try/catch：任何一筆 DB 更新失敗都不可讓整批同步中斷。 */
async function applyResult(supabase, row, fields) {
  try {
    const { error } = await supabase
      .from("official_transactions")
      .update({ ...fields, geocode_resolved_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error(`  寫入失敗（id=${row.id}，address=${row.address}）：`, err instanceof Error ? err.message : err);
    return { ok: false, error: err };
  }
}

module.exports = { syncOfficialTransactionGeocodes };
