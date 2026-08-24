/**
 * Phase 9A｜runMarketRadarSync() 兩次連跑驗收
 *
 *   npx tsx --env-file=.env --env-file=.env.local scripts/phase9a-orchestration-test.ts
 *
 * 不建立 Cron、不呼叫 LINE push、不寫 notification sent records（orchestration 本身
 * 就沒有做這兩件事，見 src/lib/market-radar-orchestration.ts）。
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { runMarketRadarSync } from "../src/lib/market-radar-orchestration";

const DIR = path.join(__dirname, "output", "community-import-preview");

function readSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

async function snapshotCounts(supabase: ReturnType<typeof createClient<any>>) {
  const [{ count: officialTransactions }, { count: areaMatches }, { count: communityCandidates }] = await Promise.all([
    supabase.from("official_transactions").select("id", { count: "exact", head: true }),
    supabase.from("official_transaction_area_matches").select("id", { count: "exact", head: true }),
    supabase.from("official_transaction_community_candidates").select("id", { count: "exact", head: true })
  ]);
  return { officialTransactions: officialTransactions ?? 0, areaMatches: areaMatches ?? 0, communityCandidates: communityCandidates ?? 0 };
}

async function main() {
  const config = readSupabaseConfig();
  if (!config) {
    console.error("找不到 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY。");
    process.exitCode = 1;
    return;
  }
  const supabase = createClient(config.url, config.serviceRoleKey, { auth: { persistSession: false } });

  const before = await snapshotCounts(supabase);
  console.log("Run 前 DB counts：", JSON.stringify(before, null, 2));

  console.log("\n=== Run 1 ===");
  const run1 = await runMarketRadarSync("manual");
  console.log(JSON.stringify({ ...run1, digestPreview: `(${run1.digestPreview.length} chars, 略)` }, null, 2));
  fs.writeFileSync(path.join(DIR, "phase9a-orchestration-run1.json"), JSON.stringify(run1, null, 2), "utf8");

  const afterRun1 = await snapshotCounts(supabase);
  console.log("\nRun 1 後 DB counts：", JSON.stringify(afterRun1, null, 2));

  console.log("\n=== Run 2（立即重跑） ===");
  const run2 = await runMarketRadarSync("manual");
  console.log(JSON.stringify({ ...run2, digestPreview: `(${run2.digestPreview.length} chars, 略)` }, null, 2));
  fs.writeFileSync(path.join(DIR, "phase9a-orchestration-run2.json"), JSON.stringify(run2, null, 2), "utf8");

  const afterRun2 = await snapshotCounts(supabase);
  console.log("\nRun 2 後 DB counts：", JSON.stringify(afterRun2, null, 2));

  // ---------- radar_sync_runs 是否真的留下兩次 execution records ----------
  const { data: syncRunRows, error: syncRunErr } = await supabase
    .from("radar_sync_runs")
    .select("id, run_type, status, started_at, finished_at, new_transactions_count, error_message")
    .in("id", [run1.runId, run2.runId]);
  if (syncRunErr) throw syncRunErr;

  const verification = {
    generated_at: new Date().toISOString(),
    db_counts_before: before,
    db_counts_after_run1: afterRun1,
    db_counts_after_run2: afterRun2,
    official_transactions_unchanged_run1_to_run2: afterRun1.officialTransactions === afterRun2.officialTransactions,
    area_matches_unchanged_run1_to_run2: afterRun1.areaMatches === afterRun2.areaMatches,
    community_candidates_unchanged_run1_to_run2: afterRun1.communityCandidates === afterRun2.communityCandidates,
    run1_inserted: run1.inserted,
    run2_inserted: run2.inserted,
    run1_errors: run1.errors,
    run2_errors: run2.errors,
    run1_status: run1.status,
    run2_status: run2.status,
    both_runs_no_unique_constraint_errors: !run1.errors.some((e) => e.includes("duplicate key")) && !run2.errors.some((e) => e.includes("duplicate key")),
    radar_sync_runs_record_count_found: (syncRunRows as unknown[]).length,
    radar_sync_runs_records: syncRunRows,
    two_execution_records_confirmed: (syncRunRows as unknown[]).length === 2,
    pending_notification_count_run1: run1.pendingNotificationCount,
    pending_notification_count_run2: run2.pendingNotificationCount,
    note_on_pending_notification: "orchestration 本階段不發 LINE、不寫 notification sent records，所以 pending 在 run1/run2 之間本來就可能不變（不是 idempotency failure，是設計上尚未接發送）。"
  };

  const allPass =
    verification.official_transactions_unchanged_run1_to_run2 &&
    verification.area_matches_unchanged_run1_to_run2 &&
    verification.community_candidates_unchanged_run1_to_run2 &&
    verification.run2_inserted === 0 &&
    verification.both_runs_no_unique_constraint_errors &&
    verification.two_execution_records_confirmed;

  fs.writeFileSync(
    path.join(DIR, "phase9a-orchestration-verification.json"),
    JSON.stringify({ ...verification, all_checks_pass: allPass }, null, 2),
    "utf8"
  );

  console.log("\n=== 驗收結果 ===");
  console.log(JSON.stringify({ ...verification, all_checks_pass: allPass }, null, 2));
}

main().catch((err) => {
  console.error("腳本執行失敗：", err);
  process.exitCode = 1;
});
