import { getSupabaseClient } from "@/lib/supabase";

export type IgChallenge = {
  account: string;
  day0Date: string;
  day0Followers: number;
  targetFollowers: number;
  challengeDays: number;
};

type ChallengeRow = {
  account: string;
  day0_date: string;
  day0_followers: number;
  target_followers: number;
  challenge_days: number;
};

function fromRow(row: ChallengeRow): IgChallenge {
  return {
    account: row.account,
    day0Date: row.day0_date,
    day0Followers: row.day0_followers,
    targetFollowers: row.target_followers,
    challengeDays: row.challenge_days
  };
}

/**
 * 在 supabase/schema.sql 執行之前，這幾張表根本不存在，查詢會直接噴錯
 * （PGRST205）。這裡吞掉錯誤回傳 null，讓 Dashboard 顯示「請先執行 schema.sql」
 * 的提示，而不是整頁 500。
 */
export async function getChallenge(): Promise<IgChallenge | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.from("ig_challenge").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as ChallengeRow) : null;
  } catch {
    return null;
  }
}

export async function upsertChallenge(input: IgChallenge): Promise<IgChallenge> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法儲存 Challenge 設定。");

  const { data, error } = await supabase
    .from("ig_challenge")
    .upsert(
      {
        id: 1,
        account: input.account,
        day0_date: input.day0Date,
        day0_followers: input.day0Followers,
        target_followers: input.targetFollowers,
        challenge_days: input.challengeDays,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    )
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as ChallengeRow);
}

export type FollowersLogEntry = { logDate: string; followers: number };

type FollowersLogRow = { log_date: string; followers: number };

function logFromRow(row: FollowersLogRow): FollowersLogEntry {
  return { logDate: row.log_date, followers: row.followers };
}

/** 依日期新到舊排序，預設抓最近 120 筆（足夠算 90 天挑戰的所有需求）。 */
export async function listFollowersLog(limit = 120): Promise<FollowersLogEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("ig_followers_log")
      .select("log_date, followers")
      .order("log_date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as FollowersLogRow[]).map(logFromRow);
  } catch {
    return [];
  }
}

/** 同一天重複輸入會覆蓋，不會疊加或報錯。 */
export async function upsertFollowersLog(logDate: string, followers: number): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法儲存粉絲數。");

  const { error } = await supabase
    .from("ig_followers_log")
    .upsert({ log_date: logDate, followers }, { onConflict: "log_date" });
  if (error) throw error;
}

/** 固定 UTC+8（台北無日光節約時間），跟 visit-counter.ts 的作法一致。 */
export function todayDateTaipei(): string {
  const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
  const taipeiNow = new Date(Date.now() + TAIPEI_OFFSET_MS);
  return taipeiNow.toISOString().slice(0, 10);
}

function daysBetween(fromDate: string, toDate: string): number {
  const fromMs = new Date(`${fromDate}T00:00:00Z`).getTime();
  const toMs = new Date(`${toDate}T00:00:00Z`).getTime();
  return Math.floor((toMs - fromMs) / 86_400_000);
}

export type ChallengeDashboard = {
  challenge: IgChallenge;
  currentFollowers: number;
  currentFollowersDate: string;
  currentDay: number;
  daysRemaining: number;
  netGrowth: number;
  remainingToTarget: number;
  completionRate: number | null;
  last7dGrowth: number;
  avgDailyGrowthRecent: number;
  neededAvgDailyGrowth: number | null;
  onPace: boolean | null;
};

/**
 * Challenge Completion Rate 一定要用 (目前 - Day0) / (目標 - Day0) 算，
 * 不能直接用「目前 / 目標」——不然會低估已經累積的進度。
 */
export async function getChallengeDashboard(): Promise<ChallengeDashboard | null> {
  const challenge = await getChallenge();
  if (!challenge) return null;

  const log = await listFollowersLog();
  const today = todayDateTaipei();

  const latest = log[0];
  const currentFollowers = latest ? latest.followers : challenge.day0Followers;
  const currentFollowersDate = latest ? latest.logDate : challenge.day0Date;

  const currentDay = Math.max(0, daysBetween(challenge.day0Date, today));
  const daysRemaining = Math.max(0, challenge.challengeDays - currentDay);

  const netGrowth = currentFollowers - challenge.day0Followers;
  const remainingToTarget = challenge.targetFollowers - currentFollowers;
  const targetSpan = challenge.targetFollowers - challenge.day0Followers;
  const completionRate = targetSpan !== 0 ? netGrowth / targetSpan : null;

  // 過去 7 日新增：找 7 天前（或最早）那筆的粉絲數，跟目前比較。
  const sevenDaysAgoDate = new Date(new Date(`${currentFollowersDate}T00:00:00Z`).getTime() - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const baselineEntry =
    log.find((entry) => entry.logDate <= sevenDaysAgoDate) ??
    (log.length ? log[log.length - 1] : { logDate: challenge.day0Date, followers: challenge.day0Followers });
  const spanDays = Math.max(1, daysBetween(baselineEntry.logDate, currentFollowersDate));
  const last7dGrowth = currentFollowers - baselineEntry.followers;
  const avgDailyGrowthRecent = last7dGrowth / Math.min(spanDays, 7);

  const neededAvgDailyGrowth = daysRemaining > 0 ? remainingToTarget / daysRemaining : null;
  const onPace = neededAvgDailyGrowth === null ? null : avgDailyGrowthRecent >= neededAvgDailyGrowth;

  return {
    challenge,
    currentFollowers,
    currentFollowersDate,
    currentDay,
    daysRemaining,
    netGrowth,
    remainingToTarget,
    completionRate,
    last7dGrowth,
    avgDailyGrowthRecent,
    neededAvgDailyGrowth,
    onPace
  };
}
