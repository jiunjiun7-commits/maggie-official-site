/**
 * Phase 8｜高雄房市情報雷達 自動化上線前 End-to-End Dry-run
 *
 *   npx tsx --env-file=.env --env-file=.env.local scripts/phase8-dry-run.ts
 *
 * 全程唯讀：不寫 official_transactions、不寫 area matches、不寫 community candidates、
 * 不寫 notification records、不呼叫 LINE API、不建立 Cron。
 *
 * Step 2 的「同步會新增幾筆」刻意不重新下載（避免「重新大量下載」），沿用上次已經下載、
 * 也已經真的完成同步的 scripts/output/plvr-kaohsiung-season-full.json（115S2，9,651 筆，
 * 產生時間 2026-08-16），用同一套 source_unique_key 去重鍵重新計算一次「如果拿這批資料去
 * upsert，會新增幾筆／跳過幾筆」——這驗證的是去重機制本身是否正確、是否 idempotent，
 * 不是「今天官方是否有新一批資料」（那需要即時下載，本階段刻意不做）。
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { toOfficialTransactionRow } = require("./geocoding/plvr-row-mapper");

const DIR = path.join(__dirname, "output", "community-import-preview");
const SEASON_FILE = path.join(__dirname, "output", "plvr-kaohsiung-season-full.json");

function readSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

async function main() {
  const config = readSupabaseConfig();
  if (!config) {
    console.error("找不到 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY。");
    process.exitCode = 1;
    return;
  }
  const supabase = createClient(config.url, config.serviceRoleKey, { auth: { persistSession: false } });

  console.log("=== Phase 8 Step 2｜模擬同步（沿用既有 season snapshot，不重新下載） ===");
  const seasonFile = JSON.parse(fs.readFileSync(SEASON_FILE, "utf8"));
  const usedSeason = seasonFile.使用季別;
  const samples = seasonFile.樣本資料;
  console.log(`季別：${usedSeason}，樣本筆數：${samples.length}，snapshot 產生時間：${seasonFile.產生時間}`);

  const rows = samples.map((s: unknown) => toOfficialTransactionRow(s, { usedSeason }));
  const uniqueKeys = [...new Set(rows.map((r: { source_unique_key: string }) => r.source_unique_key))] as string[];

  const existingKeys = new Set<string>();
  const CHUNK = 500;
  for (let i = 0; i < uniqueKeys.length; i += CHUNK) {
    const chunk = uniqueKeys.slice(i, i + CHUNK);
    const { data, error } = await supabase.from("official_transactions").select("source_unique_key").eq("source", "moi_plvr").in("source_unique_key", chunk);
    if (error) throw error;
    for (const row of data as { source_unique_key: string }[]) existingKeys.add(row.source_unique_key);
  }
  const wouldInsertCount = uniqueKeys.length - existingKeys.size;
  const wouldSkipCount = existingKeys.size;
  console.log(`模擬結果：本批唯一 key 數 ${uniqueKeys.length}，若執行同步會新增 ${wouldInsertCount} 筆、跳過（已存在）${wouldSkipCount} 筆。`);

  // ---------- geocode pending 筆數 ----------
  const { count: geocodePendingCount } = await supabase.from("official_transactions").select("id", { count: "exact", head: true }).eq("geocode_status", "pending");
  const { count: geocodeResolvedCount } = await supabase.from("official_transactions").select("id", { count: "exact", head: true }).eq("geocode_status", "resolved");
  const { count: geocodeFailedCount } = await supabase.from("official_transactions").select("id", { count: "exact", head: true }).eq("geocode_status", "failed");
  const { count: geocodeSkippedCount } = await supabase.from("official_transactions").select("id", { count: "exact", head: true }).eq("geocode_status", "skipped_land_parcel");
  console.log(`\ngeocode 現況：pending=${geocodePendingCount}, resolved=${geocodeResolvedCount}, failed=${geocodeFailedCount}, skipped_land_parcel=${geocodeSkippedCount}`);

  // ---------- area matching 現況 ----------
  const { data: areas, error: areasErr } = await supabase.from("market_radar_areas").select("id, name, is_active");
  if (areasErr) throw areasErr;
  const activeAreas = (areas as { id: string; name: string; is_active: boolean }[]).filter((a) => a.is_active);
  const { count: totalAreaMatches } = await supabase.from("official_transaction_area_matches").select("id", { count: "exact", head: true });
  console.log(`\n啟用中區域數：${activeAreas.length}（${activeAreas.map((a) => a.name).join("、")}），目前 official_transaction_area_matches 總筆數：${totalAreaMatches}`);

  // ---------- community matching 現況 ----------
  const { count: candidateCount } = await supabase.from("official_transaction_community_candidates").select("id", { count: "exact", head: true });
  const { count: autoMatchedCount } = await supabase.from("official_transaction_community_candidates").select("id", { count: "exact", head: true }).eq("match_status", "auto_matched");
  const { count: needsConfirmationCount } = await supabase.from("official_transaction_community_candidates").select("id", { count: "exact", head: true }).eq("match_status", "needs_confirmation");
  const { count: noCommunityCount } = await supabase.from("official_transaction_community_candidates").select("id", { count: "exact", head: true }).eq("match_status", "no_community");
  console.log(`\ncommunity matching 現況：candidates 總筆數=${candidateCount}（auto_matched=${autoMatchedCount}, needs_confirmation=${needsConfirmationCount}, no_community=${noCommunityCount}）`);

  // 目前有 area match 但還沒有 community candidate 的交易數（代表 community matching 還沒覆蓋到的範圍）
  const { data: matchedTxnIdsRaw, error: matchedErr } = await supabase.from("official_transaction_area_matches").select("official_transaction_id");
  if (matchedErr) throw matchedErr;
  const matchedTxnIds = [...new Set((matchedTxnIdsRaw as { official_transaction_id: string }[]).map((r) => r.official_transaction_id))];
  const { data: candidateTxnIdsRaw, error: candTxnErr } = await supabase.from("official_transaction_community_candidates").select("official_transaction_id");
  if (candTxnErr) throw candTxnErr;
  const candidateTxnIdSet = new Set((candidateTxnIdsRaw as { official_transaction_id: string }[]).map((r) => r.official_transaction_id));
  const notYetCommunityMatchedCount = matchedTxnIds.filter((id) => !candidateTxnIdSet.has(id)).length;
  console.log(`目前命中啟用區域、但還沒有 community candidate 記錄的交易數：${notYetCommunityMatchedCount}（community matching 尚未涵蓋到的範圍）`);

  const output = {
    generated_at: new Date().toISOString(),
    read_only: true,
    db_mutations_performed: false,
    step2_simulated_sync: {
      season_snapshot_used: usedSeason,
      season_snapshot_generated_at: seasonFile.產生時間,
      note: "沿用既有 season snapshot 檔案，未重新下載官方資料。",
      sample_count: samples.length,
      unique_keys: uniqueKeys.length,
      would_insert_count: wouldInsertCount,
      would_skip_existing_count: wouldSkipCount
    },
    step2_geocode: {
      pending: geocodePendingCount,
      resolved: geocodeResolvedCount,
      failed: geocodeFailedCount,
      skipped_land_parcel: geocodeSkippedCount
    },
    step2_area_matching: {
      active_area_count: activeAreas.length,
      active_area_names: activeAreas.map((a) => a.name),
      total_area_matches: totalAreaMatches
    },
    step2_community_matching: {
      candidate_total: candidateCount,
      auto_matched: autoMatchedCount,
      needs_confirmation: needsConfirmationCount,
      no_community: noCommunityCount,
      area_matched_but_not_yet_community_matched: notYetCommunityMatchedCount
    }
  };

  fs.writeFileSync(path.join(DIR, "phase8-step2-simulation.json"), JSON.stringify(output, null, 2), "utf8");
  console.log("\n已寫入 phase8-step2-simulation.json");
}

main().catch((err) => {
  console.error("腳本執行失敗：", err);
  process.exitCode = 1;
});
