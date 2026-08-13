import { getSupabaseClient } from "@/lib/supabase";

export type AreaRuleType = "road" | "district" | "section" | "community" | "address_keyword" | "bbox";

export type Bbox = { north: number; south: number; east: number; west: number };

export type MarketRadarArea = {
  id: string;
  name: string;
  district: string;
  isActive: boolean;
  sortOrder: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type MarketRadarAreaRule = {
  id: string;
  areaId: string;
  ruleType: AreaRuleType;
  ruleValue: string;
  bbox: Bbox | null;
  createdAt: string;
};

export type Community = {
  id: string;
  name: string;
  areaId: string | null;
  district: string;
  addressKeyword: string;
  lat: number | null;
  lng: number | null;
  note: string;
  createdAt: string;
  updatedAt: string;
};

type AreaRow = {
  id: string;
  name: string;
  district: string;
  is_active: boolean;
  sort_order: number;
  note: string;
  created_at: string;
  updated_at: string;
};

type AreaRuleRow = {
  id: string;
  area_id: string;
  rule_type: AreaRuleType;
  rule_value: string;
  bbox: Bbox | null;
  created_at: string;
};

type CommunityRow = {
  id: string;
  name: string;
  area_id: string | null;
  district: string;
  address_keyword: string;
  lat: number | null;
  lng: number | null;
  note: string;
  created_at: string;
  updated_at: string;
};

function areaFromRow(row: AreaRow): MarketRadarArea {
  return {
    id: row.id,
    name: row.name,
    district: row.district,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function ruleFromRow(row: AreaRuleRow): MarketRadarAreaRule {
  return {
    id: row.id,
    areaId: row.area_id,
    ruleType: row.rule_type,
    ruleValue: row.rule_value,
    bbox: row.bbox,
    createdAt: row.created_at
  };
}

function communityFromRow(row: CommunityRow): Community {
  return {
    id: row.id,
    name: row.name,
    areaId: row.area_id,
    district: row.district,
    addressKeyword: row.address_keyword,
    lat: row.lat,
    lng: row.lng,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

type AreaInput = {
  name: string;
  district: string;
  note: string;
  isActive: boolean;
  sortOrder: number;
};

function areaToRow(input: Partial<AreaInput>) {
  const row: Record<string, unknown> = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.district !== undefined) row.district = input.district;
  if (input.note !== undefined) row.note = input.note;
  if (input.isActive !== undefined) row.is_active = input.isActive;
  if (input.sortOrder !== undefined) row.sort_order = input.sortOrder;
  return row;
}

export async function listAreas(): Promise<MarketRadarArea[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("market_radar_areas")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as AreaRow[]).map(areaFromRow);
}

export async function getArea(id: string): Promise<MarketRadarArea | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from("market_radar_areas").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? areaFromRow(data as AreaRow) : null;
}

export async function createArea(input: Pick<AreaInput, "name" | "district" | "note">): Promise<MarketRadarArea> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法建立監控區域。");

  const { data, error } = await supabase
    .from("market_radar_areas")
    .insert({ name: input.name, district: input.district, note: input.note })
    .select()
    .single();
  if (error) throw error;
  return areaFromRow(data as AreaRow);
}

export async function updateArea(id: string, input: Partial<AreaInput>): Promise<MarketRadarArea | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法更新監控區域。");

  const { data, error } = await supabase
    .from("market_radar_areas")
    .update({ ...areaToRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? areaFromRow(data as AreaRow) : null;
}

export async function listAllAreaRules(): Promise<MarketRadarAreaRule[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("market_radar_area_rules")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as AreaRuleRow[]).map(ruleFromRow);
}

export async function listAreaRules(areaId: string): Promise<MarketRadarAreaRule[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("market_radar_area_rules")
    .select("*")
    .eq("area_id", areaId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as AreaRuleRow[]).map(ruleFromRow);
}

export async function addAreaRule(input: {
  areaId: string;
  ruleType: AreaRuleType;
  ruleValue?: string;
  bbox?: Bbox;
}): Promise<MarketRadarAreaRule> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法新增區域規則。");

  const { data, error } = await supabase
    .from("market_radar_area_rules")
    .insert({
      area_id: input.areaId,
      rule_type: input.ruleType,
      rule_value: input.ruleValue ?? "",
      bbox: input.bbox ?? null
    })
    .select()
    .single();
  if (error) throw error;
  return ruleFromRow(data as AreaRuleRow);
}

export async function deleteAreaRule(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法刪除區域規則。");

  const { error } = await supabase.from("market_radar_area_rules").delete().eq("id", id);
  if (error) throw error;
}

type CommunityInput = {
  name: string;
  areaId: string | null;
  district: string;
  addressKeyword: string;
  lat: number | null;
  lng: number | null;
  note: string;
};

function communityToRow(input: Partial<CommunityInput>) {
  const row: Record<string, unknown> = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.areaId !== undefined) row.area_id = input.areaId;
  if (input.district !== undefined) row.district = input.district;
  if (input.addressKeyword !== undefined) row.address_keyword = input.addressKeyword;
  if (input.lat !== undefined) row.lat = input.lat;
  if (input.lng !== undefined) row.lng = input.lng;
  if (input.note !== undefined) row.note = input.note;
  return row;
}

export async function listCommunities(): Promise<Community[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("communities")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as CommunityRow[]).map(communityFromRow);
}

export async function createCommunity(input: CommunityInput): Promise<Community> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法建立社區資料。");

  const { data, error } = await supabase.from("communities").insert(communityToRow(input)).select().single();
  if (error) throw error;
  return communityFromRow(data as CommunityRow);
}

export async function updateCommunity(id: string, input: Partial<CommunityInput>): Promise<Community | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法更新社區資料。");

  const { data, error } = await supabase
    .from("communities")
    .update({ ...communityToRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? communityFromRow(data as CommunityRow) : null;
}

export async function deleteCommunity(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法刪除社區資料。");

  const { error } = await supabase.from("communities").delete().eq("id", id);
  if (error) throw error;
}
