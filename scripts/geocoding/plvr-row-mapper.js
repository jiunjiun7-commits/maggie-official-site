/**
 * 把 plvr-fetch.js 產出的樣本物件，轉成 official_transactions 的資料列（共用模組）。
 *
 * 從 scripts/sync-plvr-sample.js 抽出來，供「40 筆快速樣本驗證」與「整季正式同步」共用，
 * 兩邊寫進資料庫的欄位對應規則保持完全一致，不會因為各自維護而日後跑出兩套不同結果。
 */

/** 去掉 UTF-8 BOM 造成的欄位名稱前綴亂碼（例如 "﻿鄉鎮市區" 開頭多一個看不見的字元）。 */
function stripBom(key) {
  return key.replace(/^﻿/, "");
}

function cleanRawRow(rawRow) {
  const cleaned = {};
  for (const [key, value] of Object.entries(rawRow)) {
    cleaned[stripBom(key)] = value;
  }
  return cleaned;
}

function findRawValue(rawRow, candidates) {
  for (const [key, value] of Object.entries(rawRow)) {
    const cleanKey = stripBom(key);
    if (candidates.some((c) => cleanKey.includes(c))) return value;
  }
  return "";
}

/**
 * source_unique_key 生成方式：
 *   1. 優先用官方「編號」欄位（政府登記序號）——這是官方資料本身就保證全域唯一的鍵。
 *   2. 如果哪天官方格式改變、某筆真的沒有編號，退回用「行政區+地址+交易日期+總價」
 *      組合雜湊，當作備援，避免整筆資料因為缺一個欄位就無法寫入。
 */
function buildSourceUniqueKey(sample, rawRow) {
  const officialSerial = findRawValue(rawRow, ["編號"]) || "";
  if (officialSerial.trim()) return officialSerial.trim();

  const fallbackParts = [sample.行政區, sample.地址, sample.交易日期, sample.總價];
  return `fallback:${fallbackParts.map((p) => String(p ?? "")).join("|")}`;
}

/** meta: { usedSeason } */
function toOfficialTransactionRow(sample, meta) {
  const rawRow = cleanRawRow(sample.官方原始資料 || {});
  const parkingRaw = findRawValue(rawRow, ["車位類別"]);
  const buildingAgeRaw = findRawValue(rawRow, ["建築完成年月"]);

  return {
    source: "moi_plvr",
    source_season: meta.usedSeason,
    source_unique_key: buildSourceUniqueKey(sample, rawRow),
    transaction_date: sample.交易日期,
    district: sample.行政區 || "",
    address: sample.地址 || "",
    building_type_raw: sample.建物型態 || "",
    floor_raw: sample.樓層 || "",
    building_area_ping: sample.建物坪數,
    land_area_ping: sample.土地坪數,
    parking_raw: parkingRaw,
    total_price: sample.總價,
    // 單價統一存「元/坪」，换算比例固定用 3.30579（1坪=3.30579平方公尺）。
    unit_price: sample.單價_元每坪,
    building_age_raw: buildingAgeRaw,
    main_use: sample.主要用途 || "",
    note: "",
    raw_data: rawRow
  };
}

module.exports = { stripBom, cleanRawRow, findRawValue, buildSourceUniqueKey, toOfficialTransactionRow };
