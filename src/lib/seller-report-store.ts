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

/**
 * 「主要平台曝光」固定四個，跟「這個平台技術上抓不抓得到資料」無關——
 * 業務分類（是不是主要銷售平台）跟技術能力（追蹤能力）是兩件事，故意分開兩個常數維護。
 * 這四個永遠一起顯示，不會因為某平台目前技術上只能人工紀錄就被移到人工曝光區。
 */
export type PrimaryExposurePlatform = "e591" | "e5168" | "leyou" | "website";

export const PRIMARY_EXPOSURE_PLATFORMS: { key: PrimaryExposurePlatform; label: string }[] = [
  { key: "e591", label: "591" },
  { key: "e5168", label: "5168" },
  { key: "leyou", label: "樂屋網" },
  { key: "website", label: "官網" }
];

/** 追蹤能力是平台固有屬性，寫死在這裡，不是資料庫欄位、不是動態計算出來的狀態。 */
export type ExposureTrackingCapability = "auto" | "partial" | "manual";

export const EXPOSURE_TRACKING_CAPABILITY: Record<PrimaryExposurePlatform, ExposureTrackingCapability> = {
  e591: "auto", // 能驗證有效性，也讀得到瀏覽數
  e5168: "partial", // 能驗證還有沒有刊登，但平台沒有公開瀏覽數
  website: "partial", // 同上（永義房屋官網物件頁）
  leyou: "manual" // 目前技術上進不去（實測回 403），完全人工紀錄，cron 不會嘗試抓取
};

/** 「人工曝光」的其餘 7 個管道（樂屋網已經是主要平台曝光的一員，不在這裡）。 */
export const MANUAL_EXPOSURE_CHANNELS = EXPOSURE_CHANNELS.filter(
  (c) => !PRIMARY_EXPOSURE_PLATFORMS.some((p) => p.key === c.key)
);

export const EXPOSURE_CAPABILITY_LABEL: Record<ExposureTrackingCapability, string> = {
  auto: "自動追蹤",
  partial: "部分追蹤",
  manual: "人工紀錄"
};

export const EXPOSURE_AUTO_STATUS_LABEL: Record<ExposureAutoSnapshot["status"], string> = {
  normal: "🟢 正常曝光",
  inactive: "🔴 原刊登網址已失效",
  unverifiable: "⚪ 無法自動驗證",
  attention: "🟡 需要注意"
};

/** 自動產生的週報摘要句——只出現在 Seller Report 的 note 欄位，不會預塞進「曝光管理」的人工補充說明。 */
export function describeExposureAutoSnapshot(platformLabel: string, snapshot: ExposureAutoSnapshot): string {
  if (snapshot.status === "inactive") {
    return `${platformLabel}原刊登網址已失效，請確認是否下架、換網址或重新刊登。`;
  }
  if (snapshot.status === "unverifiable") {
    return `本次無法自動驗證 ${platformLabel} 的刊登狀態，請自行確認。`;
  }
  if (snapshot.cumulativeViews === null) {
    return `本週 ${platformLabel} 持續曝光中，已刊登 ${snapshot.activeDays} 天（平台未提供瀏覽數）。`;
  }
  const deltaText = snapshot.weeklyViewDelta !== null ? `，本週新增 ${snapshot.weeklyViewDelta} 次瀏覽` : "";
  const attentionText =
    snapshot.status === "attention" ? "，瀏覽數已一段時間沒有增加，可能需要調整曝光策略" : "";
  return `本週 ${platformLabel} 刊登持續曝光，目前累積瀏覽 ${snapshot.cumulativeViews} 次${deltaText}${attentionText}。`;
}

export type ExposureAutoSnapshot = {
  /** attention 只在「產生週報快照」當下計算（連續 14 天瀏覽數沒變化），不是 checks 表裡存的值 */
  status: "normal" | "inactive" | "unverifiable" | "attention";
  activeDays: number;
  cumulativeViews: number | null;
  weeklyViewDelta: number | null;
  lastCheckedAt: string;
};

export type ExposureEntry = {
  done: boolean;
  note: string; // 人工補充說明／備註，維持原意，不會被自動摘要覆蓋
  /** 只有主要平台曝光四個管道、且案件已在「曝光管理」設定過的情況下才會有值；建立週報當下寫入，之後不會被 cron 追新資料回頭改掉。 */
  auto?: ExposureAutoSnapshot;
};

export type Exposure = Partial<Record<ExposureChannelKey, ExposureEntry>>;

export type Competitor = {
  name: string;
  price: string;
  totalPing: string;
  layout: string;
  parking: string;
  condition: string;
  url: string;
};

export type NextWeekStrategy = { checklist: string[]; note: string };

/** 本週推廣紀錄照片，選填，最多 4～6 張，順序就是上傳順序（不支援拖曳排序）。 */
export type PromotionPhoto = { url: string; caption: string };
export const MAX_PROMOTION_PHOTOS = 6;

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
  promotionPhotos: PromotionPhoto[];
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
  promotion_photos: PromotionPhoto[];
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
    promotionPhotos: row.promotion_photos || [],
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
  promotionPhotos: PromotionPhoto[];
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
  if (input.promotionPhotos !== undefined) {
    // 前後端雙重保險：即使表單端沒擋住，存檔前一定裁到上限，不讓資料庫存超過 6 張。
    row.promotion_photos = input.promotionPhotos.slice(0, MAX_PROMOTION_PHOTOS);
  }
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
  "promotion_photos",
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
