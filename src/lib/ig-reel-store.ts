import { getSupabaseClient } from "@/lib/supabase";

export type ContentEngine = "discovery" | "follow" | "trust";
export type Mission = "reach" | "follow" | "trust" | "engagement" | "brand";
export type ExperimentResult = "win" | "neutral" | "lose" | "inconclusive";
export type MotherReelType = "traffic" | "follow" | "trust" | "share" | "save";
export type SnapshotStage = "24h" | "72h" | "7d" | "final";

export const CONTENT_ENGINES: { key: ContentEngine; label: string }[] = [
  { key: "discovery", label: "🔥 DISCOVERY 陌生流量" },
  { key: "follow", label: "❤️ FOLLOW 人設漲粉" },
  { key: "trust", label: "🩺 TRUST 專業信任" }
];

export const MISSIONS: { key: Mission; label: string }[] = [
  { key: "reach", label: "REACH｜流量" },
  { key: "follow", label: "FOLLOW｜漲粉" },
  { key: "trust", label: "TRUST｜建立專業／信任" },
  { key: "engagement", label: "ENGAGEMENT｜互動" },
  { key: "brand", label: "BRAND｜人設／品牌溫度" }
];

export const EXPERIMENT_RESULTS: { key: ExperimentResult; label: string }[] = [
  { key: "win", label: "WIN" },
  { key: "neutral", label: "NEUTRAL" },
  { key: "lose", label: "LOSE" },
  { key: "inconclusive", label: "INCONCLUSIVE" }
];

export const MOTHER_REEL_TYPES: { key: MotherReelType; label: string }[] = [
  { key: "traffic", label: "🧬 Traffic Mother" },
  { key: "follow", label: "🧬 Follow Mother" },
  { key: "trust", label: "🧬 Trust Mother" },
  { key: "share", label: "🧬 Share Mother" },
  { key: "save", label: "🧬 Save Mother" }
];

export const SNAPSHOT_STAGES: { key: SnapshotStage; label: string }[] = [
  { key: "24h", label: "24H" },
  { key: "72h", label: "72H" },
  { key: "7d", label: "7D" },
  { key: "final", label: "Final" }
];

export type IgReel = {
  id: string;
  publishedDate: string;
  title: string;
  series: string;
  episode: string;
  contentEngine: ContentEngine;
  primaryMission: Mission;
  secondaryMission: Mission | null;
  hook: string;
  coverText: string;
  captionCta: string;
  videoLengthSec: number | null;
  reelUrl: string;
  experimentHypothesis: string;
  experimentResult: ExperimentResult | null;
  experimentWhatWorked: string;
  experimentWhatFailed: string;
  experimentShouldRepeat: string;
  experimentShouldChange: string;
  motherReelType: MotherReelType | null;
  dnaNotes: string;
  createdAt: string;
  updatedAt: string;
};

type ReelRow = {
  id: string;
  published_date: string;
  title: string;
  series: string;
  episode: string;
  content_engine: ContentEngine;
  primary_mission: Mission;
  secondary_mission: Mission | null;
  hook: string;
  cover_text: string;
  caption_cta: string;
  video_length_sec: number | null;
  reel_url: string;
  experiment_hypothesis: string;
  experiment_result: ExperimentResult | null;
  experiment_what_worked: string;
  experiment_what_failed: string;
  experiment_should_repeat: string;
  experiment_should_change: string;
  mother_reel_type: MotherReelType | null;
  dna_notes: string;
  created_at: string;
  updated_at: string;
};

function reelFromRow(row: ReelRow): IgReel {
  return {
    id: row.id,
    publishedDate: row.published_date,
    title: row.title,
    series: row.series,
    episode: row.episode,
    contentEngine: row.content_engine,
    primaryMission: row.primary_mission,
    secondaryMission: row.secondary_mission,
    hook: row.hook,
    coverText: row.cover_text,
    captionCta: row.caption_cta,
    videoLengthSec: row.video_length_sec,
    reelUrl: row.reel_url,
    experimentHypothesis: row.experiment_hypothesis,
    experimentResult: row.experiment_result,
    experimentWhatWorked: row.experiment_what_worked,
    experimentWhatFailed: row.experiment_what_failed,
    experimentShouldRepeat: row.experiment_should_repeat,
    experimentShouldChange: row.experiment_should_change,
    motherReelType: row.mother_reel_type,
    dnaNotes: row.dna_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export type ReelInput = {
  publishedDate: string;
  title: string;
  series: string;
  episode: string;
  contentEngine: ContentEngine;
  primaryMission: Mission;
  secondaryMission: Mission | null;
  hook: string;
  coverText: string;
  captionCta: string;
  videoLengthSec: number | null;
  reelUrl: string;
  experimentHypothesis: string;
  experimentResult: ExperimentResult | null;
  experimentWhatWorked: string;
  experimentWhatFailed: string;
  experimentShouldRepeat: string;
  experimentShouldChange: string;
  motherReelType: MotherReelType | null;
  dnaNotes: string;
};

function reelToRow(input: Partial<ReelInput>) {
  const row: Record<string, unknown> = {};
  if (input.publishedDate !== undefined) row.published_date = input.publishedDate;
  if (input.title !== undefined) row.title = input.title;
  if (input.series !== undefined) row.series = input.series;
  if (input.episode !== undefined) row.episode = input.episode;
  if (input.contentEngine !== undefined) row.content_engine = input.contentEngine;
  if (input.primaryMission !== undefined) row.primary_mission = input.primaryMission;
  if (input.secondaryMission !== undefined) row.secondary_mission = input.secondaryMission;
  if (input.hook !== undefined) row.hook = input.hook;
  if (input.coverText !== undefined) row.cover_text = input.coverText;
  if (input.captionCta !== undefined) row.caption_cta = input.captionCta;
  if (input.videoLengthSec !== undefined) row.video_length_sec = input.videoLengthSec;
  if (input.reelUrl !== undefined) row.reel_url = input.reelUrl;
  if (input.experimentHypothesis !== undefined) row.experiment_hypothesis = input.experimentHypothesis;
  if (input.experimentResult !== undefined) row.experiment_result = input.experimentResult;
  if (input.experimentWhatWorked !== undefined) row.experiment_what_worked = input.experimentWhatWorked;
  if (input.experimentWhatFailed !== undefined) row.experiment_what_failed = input.experimentWhatFailed;
  if (input.experimentShouldRepeat !== undefined) row.experiment_should_repeat = input.experimentShouldRepeat;
  if (input.experimentShouldChange !== undefined) row.experiment_should_change = input.experimentShouldChange;
  if (input.motherReelType !== undefined) row.mother_reel_type = input.motherReelType;
  if (input.dnaNotes !== undefined) row.dna_notes = input.dnaNotes;
  return row;
}

/**
 * 在 supabase/schema.sql 執行之前這幾張表不存在，查詢會噴 PGRST205。
 * 讀取路徑吞掉錯誤回傳空值，讓頁面顯示空清單而不是 500；
 * 寫入路徑（create/update/upsert）維持照樣拋錯，讓 API 回報清楚的錯誤訊息。
 */
export async function listReels(): Promise<IgReel[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("ig_reels")
      .select("*")
      .order("published_date", { ascending: false });
    if (error) throw error;
    return (data as ReelRow[]).map(reelFromRow);
  } catch {
    return [];
  }
}

export async function getReel(id: string): Promise<IgReel | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.from("ig_reels").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? reelFromRow(data as ReelRow) : null;
  } catch {
    return null;
  }
}

export async function createReel(input: ReelInput): Promise<IgReel> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法建立 Reel。");

  const { data, error } = await supabase.from("ig_reels").insert(reelToRow(input)).select().single();
  if (error) throw error;
  return reelFromRow(data as ReelRow);
}

export async function updateReel(id: string, input: Partial<ReelInput>): Promise<IgReel | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法更新 Reel。");

  const { data, error } = await supabase
    .from("ig_reels")
    .update({ ...reelToRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? reelFromRow(data as ReelRow) : null;
}

/* ---------- Snapshots ---------- */

export type ReelSnapshot = {
  id: string;
  reelId: string;
  stage: SnapshotStage;
  capturedAt: string;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  follows: number | null;
  profileVisits: number | null;
  avgWatchTimeSec: number | null;
  nonFollowerPct: number | null;
  reelsTabPct: number | null;
  explorePct: number | null;
  feedPct: number | null;
  storiesPct: number | null;
  isPaidBoost: boolean;
  adSpend: number | null;
  paidViews: number | null;
  paidReach: number | null;
  paidProfileVisits: number | null;
  paidFollowers: number | null;
};

type SnapshotRow = {
  id: string;
  reel_id: string;
  stage: SnapshotStage;
  captured_at: string;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  follows: number | null;
  profile_visits: number | null;
  avg_watch_time_sec: number | null;
  non_follower_pct: number | null;
  reels_tab_pct: number | null;
  explore_pct: number | null;
  feed_pct: number | null;
  stories_pct: number | null;
  is_paid_boost: boolean;
  ad_spend: number | null;
  paid_views: number | null;
  paid_reach: number | null;
  paid_profile_visits: number | null;
  paid_followers: number | null;
};

function snapshotFromRow(row: SnapshotRow): ReelSnapshot {
  return {
    id: row.id,
    reelId: row.reel_id,
    stage: row.stage,
    capturedAt: row.captured_at,
    views: row.views,
    reach: row.reach,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    saves: row.saves,
    follows: row.follows,
    profileVisits: row.profile_visits,
    avgWatchTimeSec: row.avg_watch_time_sec,
    nonFollowerPct: row.non_follower_pct,
    reelsTabPct: row.reels_tab_pct,
    explorePct: row.explore_pct,
    feedPct: row.feed_pct,
    storiesPct: row.stories_pct,
    isPaidBoost: row.is_paid_boost,
    adSpend: row.ad_spend,
    paidViews: row.paid_views,
    paidReach: row.paid_reach,
    paidProfileVisits: row.paid_profile_visits,
    paidFollowers: row.paid_followers
  };
}

export type SnapshotInput = {
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  follows: number | null;
  profileVisits: number | null;
  avgWatchTimeSec: number | null;
  nonFollowerPct: number | null;
  reelsTabPct: number | null;
  explorePct: number | null;
  feedPct: number | null;
  storiesPct: number | null;
  isPaidBoost: boolean;
  adSpend: number | null;
  paidViews: number | null;
  paidReach: number | null;
  paidProfileVisits: number | null;
  paidFollowers: number | null;
};

function snapshotToRow(input: SnapshotInput) {
  return {
    views: input.views,
    reach: input.reach,
    likes: input.likes,
    comments: input.comments,
    shares: input.shares,
    saves: input.saves,
    follows: input.follows,
    profile_visits: input.profileVisits,
    avg_watch_time_sec: input.avgWatchTimeSec,
    non_follower_pct: input.nonFollowerPct,
    reels_tab_pct: input.reelsTabPct,
    explore_pct: input.explorePct,
    feed_pct: input.feedPct,
    stories_pct: input.storiesPct,
    is_paid_boost: input.isPaidBoost,
    ad_spend: input.adSpend,
    paid_views: input.paidViews,
    paid_reach: input.paidReach,
    paid_profile_visits: input.paidProfileVisits,
    paid_followers: input.paidFollowers
  };
}

export async function listSnapshots(reelId: string): Promise<ReelSnapshot[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("ig_reel_snapshots")
      .select("*")
      .eq("reel_id", reelId)
      .order("captured_at", { ascending: true });
    if (error) throw error;
    return (data as SnapshotRow[]).map(snapshotFromRow);
  } catch {
    return [];
  }
}

/** 同一支 Reel 的同一個階段重複輸入會覆蓋更新，不會疊加或報錯。 */
export async function upsertSnapshot(
  reelId: string,
  stage: SnapshotStage,
  input: SnapshotInput
): Promise<ReelSnapshot> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法儲存數據。");

  const { data, error } = await supabase
    .from("ig_reel_snapshots")
    .upsert(
      { reel_id: reelId, stage, captured_at: new Date().toISOString(), ...snapshotToRow(input) },
      { onConflict: "reel_id,stage" }
    )
    .select()
    .single();
  if (error) throw error;
  return snapshotFromRow(data as SnapshotRow);
}

/** Reels 列表頁用：每支 Reel 只抓最新一筆快照，當作「目前數據」顯示。 */
export async function listLatestSnapshotByReel(): Promise<Map<string, ReelSnapshot>> {
  const supabase = getSupabaseClient();
  const map = new Map<string, ReelSnapshot>();
  if (!supabase) return map;

  try {
    const { data, error } = await supabase
      .from("ig_reel_snapshots")
      .select("*")
      .order("captured_at", { ascending: true });
    if (error) throw error;
    for (const row of data as SnapshotRow[]) {
      map.set(row.reel_id, snapshotFromRow(row));
    }
  } catch {
    return map;
  }
  return map;
}
