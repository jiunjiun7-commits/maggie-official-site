import { getSupabaseClient } from "@/lib/supabase";

export type SellerStatus = "active" | "sold" | "ended";

export type Seller = {
  id: string;
  communityName: string;
  district: string;
  listingTitle: string;
  ownerName: string;
  engagementStart: string;
  engagementEnd: string;
  askingPrice: string;
  address: string;
  internalNote: string;
  status: SellerStatus;
  createdAt: string;
  updatedAt: string;
};

/**
 * 屋主前台可以看到的欄位。姓名只給遮罩後版本（ownerNameMasked），
 * 完整姓名／地址／內部備註刻意不放進這個型別，從資料層就隔離，
 * 不是前端拿到完整資料再用 CSS/JS 藏起來。
 */
export type SellerPublicInfo = {
  id: string;
  communityName: string;
  ownerNameMasked: string;
  engagementStart: string;
  engagementEnd: string;
  askingPrice: string;
  status: SellerStatus;
};

/**
 * 屋主姓名遮罩：只在 server 端呼叫，回傳值才會出現在 Portal payload。
 * 2 字：留姓，名遮住（王明 → 王＊）
 * 3 字：留頭尾，中間遮住（吳小明 → 吳＊明）
 * 4 字以上：留前兩字與最後一字，中間全部收成一個＊（歐陽小明 → 歐陽＊明）
 */
export function maskOwnerName(name: string): string {
  const chars = Array.from(name.trim());
  const n = chars.length;
  if (n === 0) return "";
  if (n === 1) return "＊";
  if (n === 2) return `${chars[0]}＊`;
  if (n === 3) return `${chars[0]}＊${chars[2]}`;
  return `${chars[0]}${chars[1]}＊${chars[n - 1]}`;
}

type SellerRow = {
  id: string;
  community_name: string;
  district: string;
  listing_title: string;
  owner_name: string;
  engagement_start: string;
  engagement_end: string;
  asking_price: string;
  address: string;
  internal_note: string;
  status: SellerStatus;
  created_at: string;
  updated_at: string;
};

function fromRow(row: SellerRow): Seller {
  return {
    id: row.id,
    communityName: row.community_name,
    district: row.district,
    listingTitle: row.listing_title,
    ownerName: row.owner_name,
    engagementStart: row.engagement_start,
    engagementEnd: row.engagement_end,
    askingPrice: row.asking_price,
    address: row.address,
    internalNote: row.internal_note,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

type SellerInput = {
  communityName: string;
  district: string;
  listingTitle: string;
  ownerName: string;
  engagementStart: string;
  engagementEnd: string;
  askingPrice: string;
  address: string;
  internalNote: string;
  status: SellerStatus;
};

function toRow(input: Partial<SellerInput>) {
  const row: Record<string, unknown> = {};
  if (input.communityName !== undefined) row.community_name = input.communityName;
  if (input.district !== undefined) row.district = input.district;
  if (input.listingTitle !== undefined) row.listing_title = input.listingTitle;
  if (input.ownerName !== undefined) row.owner_name = input.ownerName;
  if (input.engagementStart !== undefined) row.engagement_start = input.engagementStart;
  if (input.engagementEnd !== undefined) row.engagement_end = input.engagementEnd;
  if (input.askingPrice !== undefined) row.asking_price = input.askingPrice;
  if (input.address !== undefined) row.address = input.address;
  if (input.internalNote !== undefined) row.internal_note = input.internalNote;
  if (input.status !== undefined) row.status = input.status;
  return row;
}

export async function listSellers(): Promise<Seller[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("sellers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as SellerRow[]).map(fromRow);
}

export async function getSeller(id: string): Promise<Seller | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from("sellers").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as SellerRow) : null;
}

/** 屋主前台專用查詢：只 select 白名單欄位，不靠前端過濾隱藏 ownerName/internalNote。 */
export async function getSellerPublicInfo(id: string): Promise<SellerPublicInfo | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("sellers")
    .select("id, community_name, owner_name, engagement_start, engagement_end, asking_price, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as Pick<
    SellerRow,
    "id" | "community_name" | "owner_name" | "engagement_start" | "engagement_end" | "asking_price" | "status"
  >;
  // owner_name 只在這裡（server 端）用來算遮罩，遮罩前的原始字串不會被放進回傳物件。
  return {
    id: row.id,
    communityName: row.community_name,
    ownerNameMasked: maskOwnerName(row.owner_name),
    engagementStart: row.engagement_start,
    engagementEnd: row.engagement_end,
    askingPrice: row.asking_price,
    status: row.status
  };
}

export async function createSeller(input: SellerInput): Promise<Seller> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法建立案件。");

  const { data, error } = await supabase.from("sellers").insert(toRow(input)).select().single();
  if (error) throw error;
  return fromRow(data as SellerRow);
}

export async function updateSeller(id: string, input: Partial<SellerInput>): Promise<Seller | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法更新案件。");

  const { data, error } = await supabase
    .from("sellers")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as SellerRow) : null;
}
