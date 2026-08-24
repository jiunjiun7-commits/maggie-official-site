import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 把 scripts/sync-plvr-season.js 裡「下載＋比對既有 key＋upsert」那段邏輯抽成正式可重用函式，
 * 供 orchestration 呼叫。業務邏輯完全沒變（去重鍵、upsert onConflict 條件都跟原本腳本一致），
 * 只是把「寫報告檔到 scripts/output」這種 CLI 專屬的部分拿掉，改成回傳結構化結果。
 *
 * 底層仍然沿用 scripts/geocoding/plvr-fetch.js 的 downloadKaohsiungSamples() 與
 * scripts/geocoding/plvr-row-mapper.js 的 toOfficialTransactionRow()——這兩支模組本來就是
 * pure 邏輯＋沒有 side effect（除了發 HTTP 請求下載官方資料），不重寫。
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { downloadKaohsiungSamples } = require("../../scripts/geocoding/plvr-fetch");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { toOfficialTransactionRow } = require("../../scripts/geocoding/plvr-row-mapper");

export type PlvrSyncResult = {
  season: string;
  matchedFile: string;
  fetched: number;
  inserted: number;
  duplicatesSkipped: number;
};

export async function syncOfficialTransactions(supabase: SupabaseClient): Promise<PlvrSyncResult> {
  const result = await downloadKaohsiungSamples(Infinity);
  const rows = result.samples.map((s: unknown) => toOfficialTransactionRow(s, { usedSeason: result.usedSeason }));
  const uniqueKeys = [...new Set(rows.map((r: { source_unique_key: string }) => r.source_unique_key))] as string[];

  // 1. upsert 之前，先查這批 key 裡哪些已經存在資料庫（跟 sync-plvr-season.js 完全相同的做法）。
  const existingKeysBefore = new Set<string>();
  const CHUNK = 500;
  for (let i = 0; i < uniqueKeys.length; i += CHUNK) {
    const chunk = uniqueKeys.slice(i, i + CHUNK);
    const { data, error } = await supabase.from("official_transactions").select("source_unique_key").eq("source", "moi_plvr").in("source_unique_key", chunk);
    if (error) throw error;
    for (const row of data as { source_unique_key: string }[]) existingKeysBefore.add(row.source_unique_key);
  }

  // 2. upsert 全部（沿用官方序號去重鍵，已存在的列會被更新覆蓋成最新內容，不會重複新增）。
  const { data: upserted, error: upsertError } = await supabase
    .from("official_transactions")
    .upsert(rows, { onConflict: "source,source_unique_key" })
    .select("id, source_unique_key");
  if (upsertError) throw upsertError;

  // 3. upsert 前不存在的 key，才是「本次新增」；其餘算本次重複/更新既有列。
  const newlyInserted = (upserted as { source_unique_key: string }[]).filter((r) => !existingKeysBefore.has(r.source_unique_key));
  const alreadyExisted = (upserted as { source_unique_key: string }[]).filter((r) => existingKeysBefore.has(r.source_unique_key));

  return {
    season: result.usedSeason,
    matchedFile: result.matchedFile,
    fetched: rows.length,
    inserted: newlyInserted.length,
    duplicatesSkipped: alreadyExisted.length
  };
}
