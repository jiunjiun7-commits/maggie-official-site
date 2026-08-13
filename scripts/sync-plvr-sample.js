/**
 * 高雄房市情報雷達 — 階段二：Supabase 寫入與去重測試
 *
 *   node --env-file=.env --env-file=.env.local scripts/sync-plvr-sample.js
 *
 * 只做一件事：把 scripts/output/plvr-kaohsiung-sample.json 裡「已經人工驗收過」的
 * 40 筆樣本，寫進正式 Supabase 的 official_transactions 表，並證明重複執行不會重複新增。
 *
 * 範圍限制（本階段刻意不做的事）：
 *   - 不做區域分類（area_id 留 null）
 *   - 不做社區比對（community_id 留 null）
 *   - 不做產品分類比對（category_id 留 null）
 *   - 不下載新資料（直接讀取上一階段已經人工驗收的樣本檔案，不是重新爬一次）
 *   - 不碰 LINE / Cron / 地圖框選 / 公司情報比對
 *
 * 去重機制：直接沿用官方資料裡「編號」欄位（政府登記序號，例如 RPXOMLNJOHLGFEE09DA），
 * 這是官方資料本身就有的全域唯一鍵，比自己組 hash 更可靠。寫進
 * source_unique_key，搭配 schema.sql 既有的 unique(source, source_unique_key)
 * 交給 Postgres 用 upsert 的 onConflict 處理去重，不是應用層自己判斷「有沒有存在」。
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.join(__dirname, "..");
const SAMPLE_FILE = path.join(ROOT, "scripts", "output", "plvr-kaohsiung-sample.json");

const SQM_PER_PING = 3.30579;

function readSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

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
 *      這只是備援機制，不是主要去重邏輯。
 */
function buildSourceUniqueKey(sample, rawRow) {
  const officialSerial = findRawValue(rawRow, ["編號"]) || "";
  if (officialSerial.trim()) return officialSerial.trim();

  const fallbackParts = [sample.行政區, sample.地址, sample.交易日期, sample.總價];
  return `fallback:${fallbackParts.map((p) => String(p ?? "")).join("|")}`;
}

function toRow(sample, meta) {
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
    // 車位資料目前只存官方主檔裡的「車位類別」原始字串；很多筆是空值，
    // 這不是解析錯誤——完整車位明細在 e_lvr_land_a_park.csv，本階段刻意不合併，
    // 留給下一階段處理（見已知問題）。
    parking_raw: parkingRaw,
    total_price: sample.總價,
    // 單價統一存「元/坪」（不是官方原始的「元/平方公尺」），
    // 换算比例固定用 3.30579（1坪=3.30579平方公尺），跟坪數換算用同一個常數，
    // 確保「單價 x 坪數 ≈ 總價」這個關係在轉換後還是對得起來。
    unit_price: sample.單價_元每坪,
    building_age_raw: buildingAgeRaw,
    main_use: sample.主要用途 || "",
    note: "",
    raw_data: rawRow
  };
}

async function main() {
  console.log("=== 高雄房市情報雷達：Supabase 寫入與去重測試 ===\n");

  const config = readSupabaseConfig();
  if (!config) {
    console.error("找不到 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 環境變數。");
    console.error("請用：node --env-file=.env --env-file=.env.local scripts/sync-plvr-sample.js");
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(SAMPLE_FILE)) {
    console.error(`找不到樣本檔案：${SAMPLE_FILE}`);
    console.error("請先執行 node scripts/verify-plvr-source.js 產生樣本。");
    process.exitCode = 1;
    return;
  }

  const sampleData = JSON.parse(fs.readFileSync(SAMPLE_FILE, "utf8"));
  const samples = sampleData.樣本資料 || [];
  console.log(`讀取樣本檔案：${path.relative(ROOT, SAMPLE_FILE)}`);
  console.log(`樣本季別：${sampleData.使用季別}，樣本筆數：${samples.length}\n`);

  const rows = samples.map((s) => toRow(s, { usedSeason: sampleData.使用季別 }));

  const uniqueKeys = new Set(rows.map((r) => r.source_unique_key));
  console.log(`本批資料 source_unique_key 唯一值數量：${uniqueKeys.size} / ${rows.length}`);
  if (uniqueKeys.size !== rows.length) {
    console.warn("⚠ 有重複的 source_unique_key，代表同一批樣本裡就有重複資料，upsert 會把它們合併成一筆。");
  }

  const supabase = createClient(config.url, config.serviceRoleKey, { auth: { persistSession: false } });

  async function countExisting() {
    const { count, error } = await supabase
      .from("official_transactions")
      .select("id", { count: "exact", head: true })
      .eq("source", "moi_plvr")
      .eq("source_season", sampleData.使用季別);
    if (error) throw error;
    return count ?? 0;
  }

  async function upsertBatch(label) {
    console.log(`\n--- ${label} ---`);
    const before = await countExisting();
    console.log(`寫入前，這個季別（${sampleData.使用季別}）在資料庫裡已有 ${before} 筆。`);

    const { data, error } = await supabase
      .from("official_transactions")
      .upsert(rows, { onConflict: "source,source_unique_key" })
      .select("id, source_unique_key");

    if (error) {
      console.error("寫入失敗：", error);
      throw error;
    }

    const after = await countExisting();
    console.log(`upsert 回傳 ${data.length} 筆（受影響的列）。`);
    console.log(`寫入後，這個季別在資料庫裡共有 ${after} 筆。`);
    return { before, after, affected: data.length };
  }

  const first = await upsertBatch("第一次寫入");
  const second = await upsertBatch("第二次重跑（證明去重）");

  console.log("\n=== 去重驗證結果 ===");
  console.log(`第一次寫入後總筆數：${first.after}`);
  console.log(`第二次重跑後總筆數：${second.after}`);
  if (first.after === second.after) {
    console.log("✅ 兩次筆數相同，證明重跑同一批資料不會重複新增，只會 upsert 覆蓋既有列。");
  } else {
    console.log("❌ 兩次筆數不同，去重沒有生效，需要檢查 source_unique_key 或 unique constraint。");
    process.exitCode = 1;
  }

  const { data: sampleRows, error: sampleError } = await supabase
    .from("official_transactions")
    .select(
      "district, address, transaction_date, building_type_raw, total_price, unit_price, source_season, source_unique_key"
    )
    .eq("source", "moi_plvr")
    .eq("source_season", sampleData.使用季別)
    .limit(5);
  if (sampleError) throw sampleError;

  console.log("\n=== 實際寫入資料庫的 5 筆範例 ===");
  console.log(JSON.stringify(sampleRows, null, 2));
}

main().catch((err) => {
  console.error("\n腳本執行失敗：", err);
  process.exitCode = 1;
});
