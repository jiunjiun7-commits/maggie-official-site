import { getSupabaseClient } from "@/lib/supabase";

export type ExposureChannelKey =
  | "website"
  | "e591"
  | "e5168"
  | "leyou"
  | "facebook"
  | "instagram"
  | "threads"
  | "shortVideo"
  | "internalPush"
  | "peerPromotion"
  | "other";

export const EXPOSURE_CHANNELS: { key: ExposureChannelKey; label: string }[] = [
  { key: "website", label: "官網" },
  { key: "e591", label: "591" },
  { key: "e5168", label: "5168" },
  { key: "leyou", label: "樂屋網" },
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "threads", label: "Threads" },
  { key: "shortVideo", label: "短影音" },
  { key: "internalPush", label: "公司內部推案" },
  { key: "peerPromotion", label: "同業推廣" },
  { key: "other", label: "其他曝光備註" }
];

export type ExposureEntry = { done: boolean; note: string };
export type Exposure = Partial<Record<ExposureChannelKey, ExposureEntry>>;

export type Competitor = { name: string; price: string; condition: string; url: string };

export type NextWeekStrategy = { checklist: string[]; note: string };

export const STRATEGY_CHECKLIST_OPTIONS = [
  "持續網路曝光",
  "公司月會強推",
  "同業合作",
  "追蹤已詢問客戶",
  "安排新帶看",
  "其他"
];

export type SellerReport = {
  id: string;
  sellerId: string;
  reportDate: string;
  periodStart: string;
  periodEnd: string;
  exposure: Exposure;
  inquiriesWeek: number;
  inquiriesTotal: number;
  viewingsWeek: number;
  viewingsTotal: number;
  viewingsPending: number;
  feedbackText: string;
  marketListingsCount: number | null;
  marketNewListings: number | null;
  marketPriceCuts: number | null;
  marketSoldCount: number | null;
  marketObservationText: string;
  competitors: Competitor[];
  maggieNotes: string;
  nextWeekStrategy: NextWeekStrategy;
  weeklyGoal: string;
  ownerActionNeeded: string;
  createdAt: string;
};

/** 屋主前台看得到的欄位——週報本身沒有內部限定欄位，跟後台看到的完全一樣。 */
export type SellerReportRow = {
  id: string;
  seller_id: string;
  report_date: string;
  period_start: string;
  period_end: string;
  exposure: Exposure;
  inquiries_week: number;
  inquiries_total: number;
  viewings_week: number;
  viewings_total: number;
  viewings_pending: number;
  feedback_text: string;
  market_listings_count: number | null;
  market_new_listings: number | null;
  market_price_cuts: number | null;
  market_sold_count: number | null;
  market_observation_text: string;
  competitors: Competitor[];
  maggie_notes: string;
  next_week_strategy: NextWeekStrategy;
  weekly_goal: string;
  owner_action_needed: string;
  created_at: string;
};

function fromRow(row: SellerReportRow): SellerReport {
  return {
    id: row.id,
    sellerId: row.seller_id,
    reportDate: row.report_date,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    exposure: row.exposure || {},
    inquiriesWeek: row.inquiries_week,
    inquiriesTotal: row.inquiries_total,
    viewingsWeek: row.viewings_week,
    viewingsTotal: row.viewings_total,
    viewingsPending: row.viewings_pending,
    feedbackText: row.feedback_text,
    marketListingsCount: row.market_listings_count,
    marketNewListings: row.market_new_listings,
    marketPriceCuts: row.market_price_cuts,
    marketSoldCount: row.market_sold_count,
    marketObservationText: row.market_observation_text,
    competitors: row.competitors || [],
    maggieNotes: row.maggie_notes,
    nextWeekStrategy: row.next_week_strategy || { checklist: [], note: "" },
    weeklyGoal: row.weekly_goal,
    ownerActionNeeded: row.owner_action_needed,
    createdAt: row.created_at
  };
}

export type SellerReportInput = {
  reportDate: string;
  periodStart: string;
  periodEnd: string;
  exposure: Exposure;
  inquiriesWeek: number;
  inquiriesTotal: number;
  viewingsWeek: number;
  viewingsTotal: number;
  viewingsPending: number;
  feedbackText: string;
  marketListingsCount: number | null;
  marketNewListings: number | null;
  marketPriceCuts: number | null;
  marketSoldCount: number | null;
  marketObservationText: string;
  competitors: Competitor[];
  maggieNotes: string;
  nextWeekStrategy: NextWeekStrategy;
  weeklyGoal: string;
  ownerActionNeeded: string;
};

function toRow(input: Partial<SellerReportInput>) {
  const row: Record<string, unknown> = {};
  if (input.reportDate !== undefined) row.report_date = input.reportDate;
  if (input.periodStart !== undefined) row.period_start = input.periodStart;
  if (input.periodEnd !== undefined) row.period_end = input.periodEnd;
  if (input.exposure !== undefined) row.exposure = input.exposure;
  if (input.inquiriesWeek !== undefined) row.inquiries_week = input.inquiriesWeek;
  if (input.inquiriesTotal !== undefined) row.inquiries_total = input.inquiriesTotal;
  if (input.viewingsWeek !== undefined) row.viewings_week = input.viewingsWeek;
  if (input.viewingsTotal !== undefined) row.viewings_total = input.viewingsTotal;
  if (input.viewingsPending !== undefined) row.viewings_pending = input.viewingsPending;
  if (input.feedbackText !== undefined) row.feedback_text = input.feedbackText;
  if (input.marketListingsCount !== undefined) row.market_listings_count = input.marketListingsCount;
  if (input.marketNewListings !== undefined) row.market_new_listings = input.marketNewListings;
  if (input.marketPriceCuts !== undefined) row.market_price_cuts = input.marketPriceCuts;
  if (input.marketSoldCount !== undefined) row.market_sold_count = input.marketSoldCount;
  if (input.marketObservationText !== undefined) row.market_observation_text = input.marketObservationText;
  if (input.competitors !== undefined) row.competitors = input.competitors;
  if (input.maggieNotes !== undefined) row.maggie_notes = input.maggieNotes;
  if (input.nextWeekStrategy !== undefined) row.next_week_strategy = input.nextWeekStrategy;
  if (input.weeklyGoal !== undefined) row.weekly_goal = input.weeklyGoal;
  if (input.ownerActionNeeded !== undefined) row.owner_action_needed = input.ownerActionNeeded;
  return row;
}

export async function listSellerReports(sellerId: string): Promise<SellerReport[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("seller_reports")
    .select("*")
    .eq("seller_id", sellerId)
    .order("report_date", { ascending: false });
  if (error) throw error;
  return (data as SellerReportRow[]).map(fromRow);
}

/**
 * 屋主前台專用查詢：明確列出白名單欄位，不是 select("*") 之後在前端隱藏。
 * 週報目前每一欄本來就是設計給屋主看的，沒有內部限定欄位；
 * 用明確欄位清單是為了「以後就算誰不小心在 seller_reports 加了內部欄位，
 * 這裡不會自動跟著洩漏」，防護是寫死在查詢本身，不是靠記得維護。
 */
const PORTAL_REPORT_COLUMNS = [
  "id",
  "seller_id",
  "report_date",
  "period_start",
  "period_end",
  "exposure",
  "inquiries_week",
  "inquiries_total",
  "viewings_week",
  "viewings_total",
  "viewings_pending",
  "feedback_text",
  "market_listings_count",
  "market_new_listings",
  "market_price_cuts",
  "market_sold_count",
  "market_observation_text",
  "competitors",
  "maggie_notes",
  "next_week_strategy",
  "weekly_goal",
  "owner_action_needed",
  "created_at"
].join(", ");

export async function listSellerReportsForPortal(sellerId: string): Promise<SellerReport[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("seller_reports")
    .select(PORTAL_REPORT_COLUMNS)
    .eq("seller_id", sellerId)
    .order("report_date", { ascending: false });
  if (error) throw error;
  return (data as unknown as SellerReportRow[]).map(fromRow);
}

export async function getLatestSellerReport(sellerId: string): Promise<SellerReport | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("seller_reports")
    .select("*")
    .eq("seller_id", sellerId)
    .order("report_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as SellerReportRow) : null;
}

export async function getSellerReport(sellerId: string, reportId: string): Promise<SellerReport | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("seller_reports")
    .select("*")
    .eq("seller_id", sellerId)
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as SellerReportRow) : null;
}

export class ReportPeriodConflictError extends Error {
  constructor() {
    super("這個週期已經有週報了，請直接編輯既有的紀錄。");
    this.name = "ReportPeriodConflictError";
  }
}

export async function createSellerReport(sellerId: string, input: SellerReportInput): Promise<SellerReport> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法建立週報。");

  const { data, error } = await supabase
    .from("seller_reports")
    .insert({ ...toRow(input), seller_id: sellerId })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") throw new ReportPeriodConflictError();
    throw error;
  }
  return fromRow(data as SellerReportRow);
}

export async function updateSellerReport(
  sellerId: string,
  reportId: string,
  input: Partial<SellerReportInput>
): Promise<SellerReport | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法更新週報。");

  const { data, error } = await supabase
    .from("seller_reports")
    .update(toRow(input))
    .eq("seller_id", sellerId)
    .eq("id", reportId)
    .select()
    .maybeSingle();

  if (error) {
    if (error.code === "23505") throw new ReportPeriodConflictError();
    throw error;
  }
  return data ? fromRow(data as SellerReportRow) : null;
}

/** 本週回報狀態：不存欄位，用最新週報日期跟今天的天數差計算，避免跟實際資料不同步。 */
export type ReportFreshness = "updated" | "due" | "overdue" | "none";

export function reportFreshness(latestReportDate: string | null, today = new Date()): ReportFreshness {
  if (!latestReportDate) return "none";
  const days = Math.floor((today.getTime() - new Date(latestReportDate).getTime()) / 86_400_000);
  if (days <= 7) return "updated";
  if (days <= 14) return "due";
  return "overdue";
}
