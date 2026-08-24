import { getSupabaseClient } from "@/lib/supabase";
import { recomputeAllActiveAreaMatches, listPendingNotificationEvents } from "@/lib/market-radar-store";
import { recomputeAllCommunityAddressAreaMatches } from "@/lib/community-address-area-matching-store";
import { recomputeCommunityMatches } from "@/lib/community-matching-store";
import { groupPendingEventsByArea, buildDailyDigestText } from "@/lib/line-messaging";
import { syncOfficialTransactions } from "@/lib/plvr-sync-service";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { syncOfficialTransactionGeocodes } = require("../../scripts/geocoding/geocode-service");

/**
 * 高雄房市情報雷達 orchestration service（Phase 9A）。
 *
 * 依序執行既有、各自已經驗證過的步驟，這支函式本身不重寫任何一段業務邏輯，只負責串接順序、
 * 蒐集統計、寫 execution log。這階段刻意只做到「組出 digest 文字＋回傳 notificationNeeded」，
 * 不呼叫 LINE push、不寫 official_transaction_area_notifications——那是下一階段（Cron 正式
 * 接上 LINE 發送）才要做的事，這裡先確保「算到哪一步都是安全、可重跑」。
 *
 * 任一步驟拋出例外，整體視為 status='failed'，把已經蒐集到的統計＋錯誤訊息一起寫進
 * radar_sync_runs，不吞掉錯誤、不假裝成功。
 */

export type RunType = "scheduled" | "manual";

export type MarketRadarSyncSummary = {
  runId: string | null;
  startedAt: string;
  finishedAt: string;
  sourceSeason: string | null;
  fetched: number;
  inserted: number;
  duplicatesSkipped: number;
  geocodePending: number;
  geocodeResolved: number;
  geocodeFailed: number;
  areaMatched: number;
  communityAutoMatched: number;
  communityNeedsConfirmation: number;
  communityNoCommunity: number;
  pendingNotificationCount: number;
  digestLength: number;
  digestPreview: string;
  notificationNeeded: boolean;
  status: "success" | "partial" | "failed";
  errors: string[];
  areaBreakdown: Record<string, { matchingStrategy: "geographic" | "community_address"; matchedCount: number }>;
};

function emptySummary(startedAt: string): MarketRadarSyncSummary {
  return {
    runId: null,
    startedAt,
    finishedAt: startedAt,
    sourceSeason: null,
    fetched: 0,
    inserted: 0,
    duplicatesSkipped: 0,
    geocodePending: 0,
    geocodeResolved: 0,
    geocodeFailed: 0,
    areaMatched: 0,
    communityAutoMatched: 0,
    communityNeedsConfirmation: 0,
    communityNoCommunity: 0,
    pendingNotificationCount: 0,
    digestLength: 0,
    digestPreview: "",
    notificationNeeded: false,
    status: "failed",
    errors: [],
    areaBreakdown: {}
  };
}

export async function runMarketRadarSync(runType: RunType = "manual"): Promise<MarketRadarSyncSummary> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法執行 Market Radar 同步。");

  const startedAt = new Date().toISOString();
  const summary = emptySummary(startedAt);
  const errors: string[] = [];

  // ---------- 開始時建立 run record（execution log，沿用既有 radar_sync_runs，不新增 schema） ----------
  const { data: runRow, error: runInsertError } = await supabase
    .from("radar_sync_runs")
    .insert({ run_type: runType, status: "partial", started_at: startedAt })
    .select("id")
    .single();
  if (runInsertError) throw runInsertError; // 連 execution log 都建不起來，直接讓呼叫端知道，不要假裝繼續
  const runId = (runRow as { id: string }).id;
  summary.runId = runId;

  // ---------- Checkpoint：每個步驟結束後把目前為止的進度＋耗時寫回 radar_sync_runs.detail。
  // 沿用既有欄位（不新增 schema），純粹是為了 Function 被 timeout 中斷時，最後一次成功的
  // checkpoint 仍然留在資料庫裡，能看出「死在哪一步」，不用只能猜。每次呼叫都是完整覆寫
  // detail（不是部分 patch），因為只有這個 process 會寫這個 run id，不會有併發互相覆蓋的問題。
  const stepTimings: Record<string, number> = {};
  const t0 = Date.now();
  const checkpoint = async (stepName: string) => {
    stepTimings[stepName] = Date.now() - t0;
    const { error } = await supabase
      .from("radar_sync_runs")
      .update({
        detail: {
          lastCompletedStep: stepName,
          stepTimingsMs: stepTimings,
          sourceSeason: summary.sourceSeason,
          fetched: summary.fetched,
          inserted: summary.inserted,
          duplicatesSkipped: summary.duplicatesSkipped,
          geocodePending: summary.geocodePending,
          geocodeResolved: summary.geocodeResolved,
          geocodeFailed: summary.geocodeFailed,
          areaMatched: summary.areaMatched,
          communityAutoMatched: summary.communityAutoMatched,
          communityNeedsConfirmation: summary.communityNeedsConfirmation,
          communityNoCommunity: summary.communityNoCommunity,
          pendingNotificationCount: summary.pendingNotificationCount,
          digestLength: summary.digestLength,
          notificationNeeded: summary.notificationNeeded,
          areaBreakdown: summary.areaBreakdown,
          errorsSoFar: errors
        }
      })
      .eq("id", runId);
    // checkpoint 寫入失敗不該讓整個流程掛掉（它只是輔助除錯用），記一筆 warning 就好。
    if (error) errors.push(`checkpoint（${stepName}）寫入失敗：${error.message}`);
  };

  // ---------- 1. 官方實價資料同步 ----------
  try {
    const syncResult = await syncOfficialTransactions(supabase);
    summary.sourceSeason = syncResult.season;
    summary.fetched = syncResult.fetched;
    summary.inserted = syncResult.inserted;
    summary.duplicatesSkipped = syncResult.duplicatesSkipped;
  } catch (err) {
    errors.push(`官方實價同步失敗：${err instanceof Error ? err.message : String(err)}`);
  }
  await checkpoint("sync_completed");

  // ---------- 2. geocode（pending-only 預設，已處理過的不會重跑；pending=0 時 geocode-service.js
  // 會在讀完官方交易列表後、還沒碰 KCG cache 之前就直接 return，不會下載/初始化 106MB 資料集） ----------
  try {
    await syncOfficialTransactionGeocodes(supabase, {});
  } catch (err) {
    errors.push(`geocode 同步失敗：${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    const [{ count: pending }, { count: resolved }, { count: failed }] = await Promise.all([
      supabase.from("official_transactions").select("id", { count: "exact", head: true }).eq("geocode_status", "pending"),
      supabase.from("official_transactions").select("id", { count: "exact", head: true }).eq("geocode_status", "resolved"),
      supabase.from("official_transactions").select("id", { count: "exact", head: true }).eq("geocode_status", "failed")
    ]);
    summary.geocodePending = pending ?? 0;
    summary.geocodeResolved = resolved ?? 0;
    summary.geocodeFailed = failed ?? 0;
  } catch (err) {
    errors.push(`geocode 狀態統計失敗：${err instanceof Error ? err.message : String(err)}`);
  }
  await checkpoint("geocode_completed");

  // ---------- 3. 區域 matching：兩種機制分流處理，互斥、不重疊 ----------
  // 地理型（bbox/polygon，目前是農十六）走 recomputeAllActiveAreaMatches()；
  // 門牌型（community_addresses，目前是中/北/南美術）走 recomputeAllCommunityAddressAreaMatches()。
  // 兩支函式內部都會先檢查「這個區域到底有沒有配置對應的規則/社區」才動手，不會誤觸對方
  // 負責的區域，也不會因為某區沒有地理規則就把它既有的 area matches 清空（Phase 10.8 修正）。
  let areaMatchedTransactionIds: string[] = [];
  try {
    const geoAreaResult = await recomputeAllActiveAreaMatches();
    summary.areaMatched = geoAreaResult.totalAreaMatchesAfter;
    for (const r of geoAreaResult.areaResults) {
      summary.areaBreakdown[r.areaName] = { matchingStrategy: "geographic", matchedCount: r.result.matchedCount };
    }

    const addressAreaResult = await recomputeAllCommunityAddressAreaMatches();
    for (const r of addressAreaResult.areaResults) {
      summary.areaBreakdown[r.areaName] = { matchingStrategy: "community_address", matchedCount: r.result.matchedCount };
    }

    const { count: totalAfter } = await supabase.from("official_transaction_area_matches").select("id", { count: "exact", head: true });
    summary.areaMatched = totalAfter ?? summary.areaMatched;

    const { data: matchRows, error: matchError } = await supabase.from("official_transaction_area_matches").select("official_transaction_id");
    if (matchError) throw matchError;
    areaMatchedTransactionIds = [...new Set((matchRows as { official_transaction_id: string }[]).map((r) => r.official_transaction_id))];
  } catch (err) {
    errors.push(`區域 matching 失敗：${err instanceof Error ? err.message : String(err)}`);
  }
  await checkpoint("area_matching_completed");

  // ---------- 4. Community matching（只處理命中啟用中區域的交易，沿用既有 idempotent service） ----------
  try {
    if (areaMatchedTransactionIds.length > 0) {
      const communityResult = await recomputeCommunityMatches(areaMatchedTransactionIds);
      summary.communityAutoMatched = communityResult.autoMatched;
      summary.communityNeedsConfirmation = communityResult.needsConfirmation;
      summary.communityNoCommunity = communityResult.noCommunity;
      if (communityResult.errors.length > 0) {
        errors.push(...communityResult.errors.map((e) => `community matching 錯誤（${e.officialTransactionId}）：${e.message}`));
      }
    }
  } catch (err) {
    errors.push(`Community matching 失敗：${err instanceof Error ? err.message : String(err)}`);
  }
  await checkpoint("community_matching_completed");

  // ---------- 5+6. pending notification 查詢 ＋ 每日摘要組字（不呼叫 LINE，不寫 notification 紀錄） ----------
  try {
    const events = await listPendingNotificationEvents();
    summary.pendingNotificationCount = events.length;
    summary.notificationNeeded = events.length > 0;

    if (events.length > 0) {
      const groups = groupPendingEventsByArea(events);
      const dateLabel = startedAt.slice(0, 10);
      const digestText = buildDailyDigestText(groups, dateLabel);
      summary.digestPreview = digestText;
      summary.digestLength = digestText.length;
    }
  } catch (err) {
    errors.push(`Pending notification / digest 組字失敗：${err instanceof Error ? err.message : String(err)}`);
  }
  await checkpoint("digest_completed");

  // ---------- 7. execution log：寫回完成狀態 ----------
  const finishedAt = new Date().toISOString();
  summary.finishedAt = finishedAt;
  summary.errors = errors;
  summary.status = errors.length === 0 ? "success" : summary.fetched > 0 || summary.pendingNotificationCount >= 0 ? "partial" : "failed";
  // 如果連第一步（同步）都完全沒有任何統計數字被算出來（sourceSeason 仍是 null 且沒有其他任何
  // 步驟留下有效數字），代表整個流程幾乎什麼都沒做成，才算 failed；只要至少有一步成功，就算
  // partial（讓呼叫端能看到「哪一步壞了」而不是整批當作失敗丟棄）。
  if (errors.length > 0 && summary.sourceSeason === null && summary.areaMatched === 0 && summary.pendingNotificationCount === 0) {
    summary.status = "failed";
  }

  const { error: updateError } = await supabase
    .from("radar_sync_runs")
    .update({
      status: summary.status,
      finished_at: finishedAt,
      new_transactions_count: summary.inserted,
      error_message: errors.length > 0 ? errors.join(" | ") : null,
      detail: {
        lastCompletedStep: "all_steps_completed",
        stepTimingsMs: stepTimings,
        sourceSeason: summary.sourceSeason,
        fetched: summary.fetched,
        inserted: summary.inserted,
        duplicatesSkipped: summary.duplicatesSkipped,
        geocodePending: summary.geocodePending,
        geocodeResolved: summary.geocodeResolved,
        geocodeFailed: summary.geocodeFailed,
        areaMatched: summary.areaMatched,
        communityAutoMatched: summary.communityAutoMatched,
        communityNeedsConfirmation: summary.communityNeedsConfirmation,
        communityNoCommunity: summary.communityNoCommunity,
        pendingNotificationCount: summary.pendingNotificationCount,
        digestLength: summary.digestLength,
        notificationNeeded: summary.notificationNeeded,
        areaBreakdown: summary.areaBreakdown,
        errors
      }
    })
    .eq("id", runId);
  if (updateError) throw updateError;

  return summary;
}
