/**
 * Phase 8.5｜recomputeCommunityMatches() 真實驗證
 *
 *   npx tsx --env-file=.env --env-file=.env.local scripts/phase8-5-test.ts
 *
 * Run 1：對農十六 35 筆真實交易呼叫 service（現況：candidates 已有 35 筆，這正是驗證
 *        「重跑既有資料不會報 unique constraint」最直接的方式）。
 * Run 2：立即重跑完全相同的 35 筆，驗證 inserted=0、DB 筆數不變、matching 結果不變。
 * Confirmed 保護測試：手動把其中 1 筆標成 confirmed（人工確認），指向錯誤的社區，
 *        再跑一次 service，驗證它被保留、不被覆蓋，且回報 conflict；測試結束後改回原狀，
 *        不留下髒資料。
 */
import { createClient } from "@supabase/supabase-js";
import { recomputeCommunityMatches } from "../src/lib/community-matching-store";

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

  const { data: areaRows, error: areaErr } = await supabase.from("market_radar_areas").select("id, name").eq("name", "農十六");
  if (areaErr) throw areaErr;
  const areaId = (areaRows as { id: string }[])[0].id;
  const { data: matchRows, error: matchErr } = await supabase.from("official_transaction_area_matches").select("official_transaction_id").eq("area_id", areaId);
  if (matchErr) throw matchErr;
  const txnIds = (matchRows as { official_transaction_id: string }[]).map((r) => r.official_transaction_id);
  console.log(`農十六命中交易數：${txnIds.length}（預期 35）`);

  const countBefore = await supabase.from("official_transaction_community_candidates").select("id", { count: "exact", head: true });
  console.log(`Run 1 前 candidate 總筆數：${countBefore.count}`);

  console.log("\n=== Run 1 ===");
  const run1 = await recomputeCommunityMatches(txnIds);
  console.log(JSON.stringify(run1, null, 2));

  const countAfterRun1 = await supabase.from("official_transaction_community_candidates").select("id", { count: "exact", head: true });
  console.log(`Run 1 後 candidate 總筆數：${countAfterRun1.count}`);

  const { data: matchingSnapshotAfterRun1 } = await supabase
    .from("official_transaction_community_candidates")
    .select("official_transaction_id, community_id, match_status")
    .in("official_transaction_id", txnIds)
    .order("official_transaction_id", { ascending: true });

  console.log("\n=== Run 2（立即重跑完全相同的 35 筆） ===");
  const run2 = await recomputeCommunityMatches(txnIds);
  console.log(JSON.stringify(run2, null, 2));

  const countAfterRun2 = await supabase.from("official_transaction_community_candidates").select("id", { count: "exact", head: true });
  console.log(`Run 2 後 candidate 總筆數：${countAfterRun2.count}`);

  const { data: matchingSnapshotAfterRun2 } = await supabase
    .from("official_transaction_community_candidates")
    .select("official_transaction_id, community_id, match_status")
    .in("official_transaction_id", txnIds)
    .order("official_transaction_id", { ascending: true });

  const matchingResultUnchanged = JSON.stringify(matchingSnapshotAfterRun1) === JSON.stringify(matchingSnapshotAfterRun2);

  console.log("\n=== Run1 vs Run2 比較 ===");
  console.log(
    JSON.stringify(
      {
        run1_inserted: run1.inserted,
        run2_inserted: run2.inserted,
        run2_inserted_is_0: run2.inserted === 0,
        candidate_count_before: countBefore.count,
        candidate_count_after_run1: countAfterRun1.count,
        candidate_count_after_run2: countAfterRun2.count,
        candidate_count_unchanged_run1_to_run2: countAfterRun1.count === countAfterRun2.count,
        matching_result_unchanged_run1_to_run2: matchingResultUnchanged,
        unique_constraint_errors: run1.errors.length + run2.errors.length
      },
      null,
      2
    )
  );

  // ---------- confirmed 保護測試 ----------
  console.log("\n=== Confirmed 保護測試 ===");
  const sampleId = txnIds[0];
  const { data: originalRow, error: origErr } = await supabase
    .from("official_transaction_community_candidates")
    .select("*")
    .eq("official_transaction_id", sampleId)
    .single();
  if (origErr) throw origErr;
  console.log("測試前原始記錄：", JSON.stringify(originalRow));

  // 找一個「錯的」community_id（隨便挑另一個社區），模擬人工確認成一個跟 deterministic matching 不同的結果
  const { data: otherCommunity } = await supabase.from("communities").select("id, name").neq("id", originalRow.community_id ?? "00000000-0000-0000-0000-000000000000").limit(1).single();
  const fakeConfirmedCommunityId = otherCommunity!.id;

  const { error: setConfirmedErr } = await supabase
    .from("official_transaction_community_candidates")
    .update({ community_id: fakeConfirmedCommunityId, match_status: "confirmed" })
    .eq("official_transaction_id", sampleId);
  if (setConfirmedErr) throw setConfirmedErr;
  console.log(`已手動把 ${sampleId} 標成 confirmed，指向「${otherCommunity!.name}」（刻意跟 deterministic matching 結果不同，模擬人工確認）`);

  const run3 = await recomputeCommunityMatches(txnIds);
  console.log("\n重跑 service 後結果：", JSON.stringify({ inserted: run3.inserted, updated: run3.updated, unchanged: run3.unchanged, skippedConfirmed: run3.skippedConfirmed, conflicts: run3.conflicts }, null, 2));

  const { data: afterRow, error: afterErr } = await supabase
    .from("official_transaction_community_candidates")
    .select("*")
    .eq("official_transaction_id", sampleId)
    .single();
  if (afterErr) throw afterErr;
  console.log("service 執行後該筆記錄：", JSON.stringify(afterRow));

  const confirmedPreserved = afterRow.match_status === "confirmed" && afterRow.community_id === fakeConfirmedCommunityId;
  const conflictReported = run3.conflicts.some((c) => c.officialTransactionId === sampleId);

  // ---------- 還原測試資料 ----------
  const { error: restoreErr } = await supabase
    .from("official_transaction_community_candidates")
    .update({ community_id: originalRow.community_id, match_status: originalRow.match_status, match_reason: originalRow.match_reason })
    .eq("official_transaction_id", sampleId);
  if (restoreErr) throw restoreErr;
  const { data: restoredRow } = await supabase.from("official_transaction_community_candidates").select("*").eq("official_transaction_id", sampleId).single();
  const restoredCorrectly = JSON.stringify(restoredRow) === JSON.stringify(originalRow);

  console.log("\n=== Confirmed 保護測試結果 ===");
  console.log(
    JSON.stringify(
      {
        confirmed_preserved: confirmedPreserved,
        conflict_reported: conflictReported,
        test_data_restored_correctly: restoredCorrectly
      },
      null,
      2
    )
  );

  const finalCount = await supabase.from("official_transaction_community_candidates").select("id", { count: "exact", head: true });
  console.log(`\n測試全部結束後 candidate 總筆數：${finalCount.count}`);
}

main().catch((err) => {
  console.error("腳本執行失敗：", err);
  process.exitCode = 1;
});
