import { getSupabaseClient } from "@/lib/supabase";
import { classifyDeal, listProductCategoryRules } from "@/lib/market-radar-store";

export type InternalDealSourceType = "internal_announcement" | "external_brand_intel" | "other";
export type InternalDealMatchStatus = "unmatched" | "candidate" | "matched";

export type InternalDeal = {
  id: string;
  sourceType: InternalDealSourceType;
  transactionDate: string | null;
  internalAnnouncedDate: string | null;
  infoReceivedDate: string | null;
  district: string;
  address: string;
  communityId: string | null;
  communityNameInput: string;
  mainUseInput: string;
  buildingTypeInput: string;
  categoryId: string | null;
  needsReview: boolean;
  buildingAreaPing: number | null;
  landAreaPing: number | null;
  parkingRaw: string;
  totalPrice: number | null;
  unitPrice: number | null;
  dealBrand: string | null;
  dealBranch: string | null;
  infoSource: string | null;
  verified: boolean;
  note: string;
  areaId: string | null;
  matchStatus: InternalDealMatchStatus;
  matchedOfficialId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type InternalDealRow = {
  id: string;
  source_type: InternalDealSourceType;
  transaction_date: string | null;
  internal_announced_date: string | null;
  info_received_date: string | null;
  district: string;
  address: string;
  community_id: string | null;
  community_name_input: string;
  main_use_input: string;
  building_type_input: string;
  category_id: string | null;
  needs_review: boolean;
  building_area_ping: number | null;
  land_area_ping: number | null;
  parking_raw: string;
  total_price: number | null;
  unit_price: number | null;
  deal_brand: string | null;
  deal_branch: string | null;
  info_source: string | null;
  verified: boolean;
  note: string;
  area_id: string | null;
  match_status: InternalDealMatchStatus;
  matched_official_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function fromRow(row: InternalDealRow): InternalDeal {
  return {
    id: row.id,
    sourceType: row.source_type,
    transactionDate: row.transaction_date,
    internalAnnouncedDate: row.internal_announced_date,
    infoReceivedDate: row.info_received_date,
    district: row.district,
    address: row.address,
    communityId: row.community_id,
    communityNameInput: row.community_name_input,
    mainUseInput: row.main_use_input,
    buildingTypeInput: row.building_type_input,
    categoryId: row.category_id,
    needsReview: row.needs_review,
    buildingAreaPing: row.building_area_ping,
    landAreaPing: row.land_area_ping,
    parkingRaw: row.parking_raw,
    totalPrice: row.total_price,
    unitPrice: row.unit_price,
    dealBrand: row.deal_brand,
    dealBranch: row.deal_branch,
    infoSource: row.info_source,
    verified: row.verified,
    note: row.note,
    areaId: row.area_id,
    matchStatus: row.match_status,
    matchedOfficialId: row.matched_official_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export type InternalDealInput = {
  sourceType: InternalDealSourceType;
  transactionDate: string | null;
  internalAnnouncedDate: string | null;
  infoReceivedDate: string | null;
  district: string;
  address: string;
  communityNameInput: string;
  mainUseInput: string;
  buildingTypeInput: string;
  buildingAreaPing: number | null;
  landAreaPing: number | null;
  parkingRaw: string;
  totalPrice: number | null;
  unitPrice: number | null;
  dealBrand: string | null;
  dealBranch: string | null;
  infoSource: string | null;
  verified: boolean;
  note: string;
  createdBy: string;
};

export async function listInternalDeals(): Promise<InternalDeal[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("internal_deals")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as InternalDealRow[]).map(fromRow);
}

export async function getInternalDeal(id: string): Promise<InternalDeal | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from("internal_deals").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as InternalDealRow) : null;
}

/**
 * 用名稱去比對既有社區，找不到就回傳 null——不會自動新增社區。
 * 同名比對用去除頭尾空白後完全相等，避免因為打法不同（例：「凹子底之心」vs
 * 「凹子底之心大樓」）誤配到錯的社區。
 */
async function findCommunityIdByName(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from("communities").select("id, name").eq("name", trimmed).maybeSingle();
  if (error) throw error;
  return data ? (data as { id: string }).id : null;
}

function toRow(input: InternalDealInput, classification: { categoryId: string | null; needsReview: boolean }) {
  return {
    source: "internal",
    source_type: input.sourceType,
    transaction_date: input.transactionDate,
    internal_announced_date: input.internalAnnouncedDate,
    info_received_date: input.infoReceivedDate,
    district: input.district,
    address: input.address,
    community_name_input: input.communityNameInput,
    main_use_input: input.mainUseInput,
    building_type_input: input.buildingTypeInput,
    category_id: classification.categoryId,
    needs_review: classification.needsReview,
    building_area_ping: input.buildingAreaPing,
    land_area_ping: input.landAreaPing,
    parking_raw: input.parkingRaw,
    total_price: input.totalPrice,
    unit_price: input.unitPrice,
    deal_brand: input.dealBrand,
    deal_branch: input.dealBranch,
    info_source: input.infoSource,
    verified: input.verified,
    note: input.note,
    created_by: input.createdBy
  };
}

export async function createInternalDeal(input: InternalDealInput): Promise<InternalDeal> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法建立內部成交情報。");

  const rules = await listProductCategoryRules();
  const classification = classifyDeal(input.mainUseInput, input.buildingTypeInput, rules);
  const communityId = await findCommunityIdByName(input.communityNameInput);

  const { data, error } = await supabase
    .from("internal_deals")
    .insert({ ...toRow(input, classification), community_id: communityId })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as InternalDealRow);
}

export async function updateInternalDeal(
  id: string,
  input: Partial<Pick<InternalDealInput, "verified" | "note" | "dealBrand" | "dealBranch" | "infoSource">>
): Promise<InternalDeal | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法更新內部成交情報。");

  const row: Record<string, unknown> = {};
  if (input.verified !== undefined) row.verified = input.verified;
  if (input.note !== undefined) row.note = input.note;
  if (input.dealBrand !== undefined) row.deal_brand = input.dealBrand;
  if (input.dealBranch !== undefined) row.deal_branch = input.dealBranch;
  if (input.infoSource !== undefined) row.info_source = input.infoSource;
  row.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from("internal_deals").update(row).eq("id", id).select().maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as InternalDealRow) : null;
}
