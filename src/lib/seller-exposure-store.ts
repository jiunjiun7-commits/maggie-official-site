import { getSupabaseClient } from "@/lib/supabase";
import {
  EXPOSURE_TRACKING_CAPABILITY,
  type ExposureAutoSnapshot,
  type PrimaryExposurePlatform
} from "@/lib/seller-report-store";

export type ExposureStatus = "normal" | "inactive" | "unverifiable";

export type ExposureLink = {
  id: string;
  sellerId: string;
  platform: PrimaryExposurePlatform;
  listingUrl: string | null;
  startedAt: string;
  currentStatus: ExposureStatus;
  currentViews: number | null;
  lastCheckedAt: string | null;
  errorReason: string;
  manualNote: string;
  createdAt: string;
  updatedAt: string;
};

type ExposureLinkRow = {
  id: string;
  seller_id: string;
  platform: PrimaryExposurePlatform;
  listing_url: string | null;
  started_at: string;
  current_status: ExposureStatus;
  current_views: number | null;
  last_checked_at: string | null;
  error_reason: string;
  manual_note: string;
  created_at: string;
  updated_at: string;
};

function fromLinkRow(row: ExposureLinkRow): ExposureLink {
  return {
    id: row.id,
    sellerId: row.seller_id,
    platform: row.platform,
    listingUrl: row.listing_url,
    startedAt: row.started_at,
    currentStatus: row.current_status,
    currentViews: row.current_views,
    lastCheckedAt: row.last_checked_at,
    errorReason: row.error_reason,
    manualNote: row.manual_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class ExposureLinkValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExposureLinkValidationError";
  }
}

export type ExposureLinkInput = {
  platform: PrimaryExposurePlatform;
  listingUrl: string | null;
  startedAt: string;
  manualNote: string;
};

/** 給每日 cron 用：撈出所有需要自動檢查的連結（樂屋網 platform='leyou' 是人工紀錄，完全排除，不對它發請求）。 */
export async function listAllTrackableExposureLinks(): Promise<ExposureLink[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase.from("seller_exposure_links").select("*").neq("platform", "leyou");
  if (error) throw error;
  return (data as ExposureLinkRow[]).map(fromLinkRow);
}

export async function listExposureLinks(sellerId: string): Promise<ExposureLink[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase.from("seller_exposure_links").select("*").eq("seller_id", sellerId);
  if (error) throw error;
  return (data as ExposureLinkRow[]).map(fromLinkRow);
}

/** 設定一次網址／開始日期即可，之後重複呼叫就是更新同一筆（seller_id+platform 唯一）。 */
export async function upsertExposureLink(sellerId: string, input: ExposureLinkInput): Promise<ExposureLink> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法設定曝光追蹤。");

  const capability = EXPOSURE_TRACKING_CAPABILITY[input.platform];
  const listingUrl = input.listingUrl?.trim() || null;
  if (capability !== "manual" && !listingUrl) {
    throw new ExposureLinkValidationError("這個平台需要填刊登網址才能追蹤。");
  }

  const { data, error } = await supabase
    .from("seller_exposure_links")
    .upsert(
      {
        seller_id: sellerId,
        platform: input.platform,
        listing_url: listingUrl,
        started_at: input.startedAt,
        manual_note: input.manualNote,
        updated_at: new Date().toISOString()
      },
      { onConflict: "seller_id,platform" }
    )
    .select()
    .single();

  if (error) throw error;
  return fromLinkRow(data as ExposureLinkRow);
}

export async function updateExposureLinkCheckResult(
  linkId: string,
  result: { status: ExposureStatus; views: number | null; errorReason: string }
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("seller_exposure_links")
    .update({
      current_status: result.status,
      current_views: result.views,
      last_checked_at: new Date().toISOString(),
      error_reason: result.errorReason,
      updated_at: new Date().toISOString()
    })
    .eq("id", linkId);
  if (error) throw error;
}

export async function insertExposureCheck(
  linkId: string,
  result: { status: ExposureStatus; views: number | null; errorReason: string }
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.from("seller_exposure_checks").insert({
    exposure_link_id: linkId,
    status: result.status,
    views: result.views,
    error_reason: result.errorReason
  });
  if (error) throw error;
}

/** 找「這個時間點之前（含）最新一筆」檢查紀錄，拿來算週期末/週期初的瀏覽數快照。 */
async function latestCheckAtOrBefore(
  linkId: string,
  cutoffIso: string
): Promise<{ views: number | null; status: ExposureStatus; checkedAt: string } | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("seller_exposure_checks")
    .select("views, status, checked_at")
    .eq("exposure_link_id", linkId)
    .lte("checked_at", cutoffIso)
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { views: data.views, status: data.status, checkedAt: data.checked_at };
}

/** 連續 14 天以上瀏覽數沒有變化，判定「需要注意」——只在產生快照當下算，不是 checks 表裡存的值。 */
async function hasStagnantViews(linkId: string, asOfIso: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const fourteenDaysAgo = new Date(new Date(asOfIso).getTime() - 14 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("seller_exposure_checks")
    .select("views, checked_at")
    .eq("exposure_link_id", linkId)
    .lte("checked_at", asOfIso)
    .gte("checked_at", fourteenDaysAgo)
    .not("views", "is", null)
    .order("checked_at", { ascending: true });
  if (error) throw error;
  const rows = data as { views: number; checked_at: string }[];
  if (rows.length < 2) return false;
  // 這段期間內第一筆跟最後一筆瀏覽數相同 = 這段時間都沒有變化
  return rows[0].views === rows[rows.length - 1].views;
}

/**
 * 建立/編輯週報時呼叫一次，把「報告週期內」的追蹤數據算成快照塞進 exposure.auto。
 * 之後就是固定值，不會因為 cron 之後抓到新數字而回頭改到已建立的週報。
 */
export async function buildExposureAutoSnapshot(
  link: ExposureLink,
  periodEnd: string
): Promise<ExposureAutoSnapshot> {
  const periodEndIso = new Date(`${periodEnd}T23:59:59.999Z`).toISOString();
  const periodStartIso = new Date(`${periodEnd}T00:00:00.000Z`).toISOString();

  const latest = await latestCheckAtOrBefore(link.id, periodEndIso);
  const previous = await latestCheckAtOrBefore(
    link.id,
    new Date(new Date(periodStartIso).getTime() - 86_400_000).toISOString()
  );

  const cumulativeViews = latest?.views ?? null;
  const weeklyViewDelta =
    cumulativeViews !== null && previous?.views != null ? cumulativeViews - previous.views : null;

  let status: ExposureAutoSnapshot["status"] = latest?.status ?? "unverifiable";
  if (status === "normal" && cumulativeViews !== null) {
    const stagnant = await hasStagnantViews(link.id, periodEndIso);
    if (stagnant) status = "attention";
  }

  const activeDays = Math.max(
    0,
    Math.floor((new Date(periodEnd).getTime() - new Date(link.startedAt).getTime()) / 86_400_000)
  );

  return {
    status,
    activeDays,
    cumulativeViews,
    weeklyViewDelta,
    lastCheckedAt: latest?.checkedAt ?? link.lastCheckedAt ?? ""
  };
}
