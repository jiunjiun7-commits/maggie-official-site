import { getSupabaseClient } from "@/lib/supabase";
import { parseChineseFloorLabel } from "@/lib/chinese-numeral";

export type AreaRuleType = "road" | "district" | "section" | "community" | "address_keyword" | "bbox" | "polygon";

export type Bbox = { north: number; south: number; east: number; west: number };

export type LatLng = { lat: number; lng: number };

/** 至少 3 個點的多邊形頂點陣列，首尾隱含自動封閉，不用重複存最後一點。 */
export type Polygon = LatLng[];

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
  polygon: Polygon | null;
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
  polygon: Polygon | null;
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
    polygon: row.polygon,
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
  polygon?: Polygon;
}): Promise<MarketRadarAreaRule> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法新增區域規則。");

  const { data, error } = await supabase
    .from("market_radar_area_rules")
    .insert({
      area_id: input.areaId,
      rule_type: input.ruleType,
      rule_value: input.ruleValue ?? "",
      bbox: input.bbox ?? null,
      polygon: input.polygon ?? null
    })
    .select()
    .single();
  if (error) throw error;
  return ruleFromRow(data as AreaRuleRow);
}

/** 目前只用來讓既有 polygon 規則重新編輯頂點（拖曳節點存檔），不開放改 ruleType。 */
export async function updateAreaRulePolygon(id: string, polygon: Polygon): Promise<MarketRadarAreaRule | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法更新區域規則。");

  const { data, error } = await supabase
    .from("market_radar_area_rules")
    .update({ polygon })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? ruleFromRow(data as AreaRuleRow) : null;
}

/** 跟 updateAreaRulePolygon 對稱：讓既有 bbox 規則可以重新編輯範圍（拖曳角點存檔），不開放改 ruleType。 */
export async function updateAreaRuleBbox(id: string, bbox: Bbox): Promise<MarketRadarAreaRule | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法更新區域規則。");

  const { data, error } = await supabase
    .from("market_radar_area_rules")
    .update({ bbox })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? ruleFromRow(data as AreaRuleRow) : null;
}

export async function deleteAreaRule(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法刪除區域規則。");

  const { error } = await supabase.from("market_radar_area_rules").delete().eq("id", id);
  if (error) throw error;
}

export type AreaMatchRecomputeResult = {
  totalEligible: number;
  matchedCount: number;
  insertedCount: number;
  deletedCount: number;
  updatedCount: number;
  unchangedCount: number;
};

/**
 * 重新計算單一區域的官方交易命中結果（official_transaction_area_matches）。
 *
 * 命中判定沿用既有、已驗證過的 isPointInBbox()/isPointInPolygon()，只對「這個區域」的
 * bbox/polygon 規則跑，不影響其他區域已存的命中結果。算出新結果後，靠 Postgres function
 * `recompute_area_matches`（見 schema.sql）在資料庫端同一個 transaction 內完成
 * 差異比對＋insert/delete/update，避免多次 API 呼叫中途失敗留下半更新狀態。
 */
export async function recomputeAreaMatches(areaId: string): Promise<AreaMatchRecomputeResult> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法重新計算區域命中結果。");

  const rules = await listAreaRules(areaId);
  const bboxRules = rules.filter((r) => r.ruleType === "bbox" && r.bbox);
  const polygonRules = rules.filter((r) => r.ruleType === "polygon" && r.polygon);

  // Supabase/PostgREST 預設單次請求最多回傳 1000 列，資料量成長後（例如整季同步後上千筆
  // 有座標的交易）如果不分頁，會靜默截斷成只算前 1000 筆，導致區域命中判定不完整卻不會報錯。
  // 用 .range() 分頁抓完全部符合條件的列，才是正確的「所有已有座標的交易」。
  const PAGE_SIZE = 1000;
  const eligible: { id: string; lat: number; lng: number }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: page, error } = await supabase
      .from("official_transactions")
      .select("id, lat, lng")
      .not("lat", "is", null)
      .not("lng", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const pageRows = page as { id: string; lat: number; lng: number }[];
    eligible.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
  }

  const matches = eligible
    .map((row) => {
      const matchedRuleIds: string[] = [];
      for (const r of bboxRules) {
        if (isPointInBbox(row.lat, row.lng, r.bbox as Bbox)) matchedRuleIds.push(r.id);
      }
      for (const r of polygonRules) {
        if (isPointInPolygon(row.lat, row.lng, r.polygon as Polygon)) matchedRuleIds.push(r.id);
      }
      return { official_transaction_id: row.id, matched_rule_ids: matchedRuleIds };
    })
    .filter((m) => m.matched_rule_ids.length > 0);

  const { data: rpcData, error: rpcError } = await supabase.rpc("recompute_area_matches", {
    p_area_id: areaId,
    p_matches: matches
  });
  if (rpcError) throw rpcError;

  const result = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as
    | { inserted_count: number; deleted_count: number; updated_count: number; unchanged_count: number }
    | null;

  return {
    totalEligible: eligible.length,
    matchedCount: matches.length,
    insertedCount: result?.inserted_count ?? 0,
    deletedCount: result?.deleted_count ?? 0,
    updatedCount: result?.updated_count ?? 0,
    unchangedCount: result?.unchanged_count ?? 0
  };
}

export type AllAreaMatchRecomputeResult = {
  areaResults: { areaId: string; areaName: string; result: AreaMatchRecomputeResult }[];
  totalAreaMatchesAfter: number;
};

/**
 * 對「所有目前啟用中」的區域各自呼叫一次 recomputeAreaMatches()（單一區域的邏輯完全不變，
 * 這裡只是加一層迴圈批次入口，給 orchestration 用，不影響既有「單一區域重算」API route）。
 */
export async function recomputeAllActiveAreaMatches(): Promise<AllAreaMatchRecomputeResult> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法重新計算區域命中結果。");

  const allAreas = await listAreas();
  const activeAreas = allAreas.filter((a) => a.isActive);

  const areaResults: { areaId: string; areaName: string; result: AreaMatchRecomputeResult }[] = [];
  for (const area of activeAreas) {
    const result = await recomputeAreaMatches(area.id);
    areaResults.push({ areaId: area.id, areaName: area.name, result });
  }

  const { count: totalAreaMatchesAfter } = await supabase.from("official_transaction_area_matches").select("id", { count: "exact", head: true });

  return { areaResults, totalAreaMatchesAfter: totalAreaMatchesAfter ?? 0 };
}

export type NotificationEvent = {
  officialTransactionId: string;
  address: string;
  district: string;
  transactionDate: string | null;
  totalPrice: number | null;
  unitPrice: number | null;
  buildingAreaPing: number | null;
  floorRaw: string;
  floorNumber: number | null;
  totalFloors: number | null;
  communityName: string | null;
  geocodeStatus: string;
  geocodeMatchStatus: string | null;
  geocodeSource: string | null;
  matchedAreas: { areaId: string; areaName: string; matchedRuleIds: string[] }[];
};

/**
 * 待通知清單（通知中心 Preview 用）：把 official_transaction_area_matches 依交易分組，
 * 一筆交易同時命中多個區域時合併成同一個「事件」，列出所有命中的區域，不會拆成好幾則。
 *
 * 只列「尚未實際通知過」的組合（左邊 official_transaction_area_matches 減去右邊
 * official_transaction_area_notifications 裡已經存在的 (official_transaction_id, area_id)）、
 * geocode_status='resolved' 的交易、is_active=true 的區域。
 *
 * 這支函式純讀取，不寫入 official_transaction_area_notifications——那張表只在真的透過某個
 * 通道（目前只有 'line'）送出成功後才會寫入，Preview 頁面看過不算數。
 */
export async function listPendingNotificationEvents(): Promise<NotificationEvent[]> {
  return buildPendingNotificationEvents();
}

/** 只查單一筆交易的待通知事件（發送前重新確認用，不信任前端傳來的內容）。已通知過則回傳 null。 */
export async function getPendingNotificationEventById(officialTransactionId: string): Promise<NotificationEvent | null> {
  const events = await buildPendingNotificationEvents(officialTransactionId);
  return events.find((e) => e.officialTransactionId === officialTransactionId) ?? null;
}

async function buildPendingNotificationEvents(onlyTransactionId?: string): Promise<NotificationEvent[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const allAreas = await listAreas();
  const activeAreaIds = new Set(allAreas.filter((a) => a.isActive).map((a) => a.id));
  const areaNameById = new Map(allAreas.map((a) => [a.id, a.name]));

  type MatchRow = { official_transaction_id: string; area_id: string; matched_rule_ids: string[] };
  const matches: MatchRow[] = [];
  if (onlyTransactionId) {
    const { data, error } = await supabase
      .from("official_transaction_area_matches")
      .select("official_transaction_id, area_id, matched_rule_ids")
      .eq("official_transaction_id", onlyTransactionId);
    if (error) throw error;
    matches.push(...(data as MatchRow[]));
  } else {
    const MATCH_PAGE = 1000;
    for (let from = 0; ; from += MATCH_PAGE) {
      const { data, error } = await supabase
        .from("official_transaction_area_matches")
        .select("official_transaction_id, area_id, matched_rule_ids")
        .order("official_transaction_id", { ascending: true })
        .range(from, from + MATCH_PAGE - 1);
      if (error) throw error;
      const page = data as MatchRow[];
      matches.push(...page);
      if (page.length < MATCH_PAGE) break;
    }
  }
  const activeMatches = matches.filter((m) => activeAreaIds.has(m.area_id));
  if (activeMatches.length === 0) return [];

  type NotifiedRow = { official_transaction_id: string; area_id: string };
  const notified: NotifiedRow[] = [];
  const NOTIFIED_PAGE = 1000;
  for (let from = 0; ; from += NOTIFIED_PAGE) {
    const { data, error } = await supabase
      .from("official_transaction_area_notifications")
      .select("official_transaction_id, area_id")
      .order("official_transaction_id", { ascending: true })
      .range(from, from + NOTIFIED_PAGE - 1);
    if (error) throw error;
    const page = data as NotifiedRow[];
    notified.push(...page);
    if (page.length < NOTIFIED_PAGE) break;
  }
  const notifiedKeys = new Set(notified.map((n) => `${n.official_transaction_id}:${n.area_id}`));
  const pendingMatches = activeMatches.filter((m) => !notifiedKeys.has(`${m.official_transaction_id}:${m.area_id}`));
  if (pendingMatches.length === 0) return [];

  const transactionIds = [...new Set(pendingMatches.map((m) => m.official_transaction_id))];

  type TransactionRow = {
    id: string;
    address: string;
    district: string;
    transaction_date: string | null;
    total_price: number | null;
    unit_price: number | null;
    building_area_ping: number | null;
    floor_raw: string;
    geocode_status: string;
    geocode_match_status: string | null;
    geocode_source: string | null;
    raw_data: Record<string, unknown>;
  };
  const transactionsById = new Map<string, TransactionRow>();
  const TXN_CHUNK = 150; // .in() 用 UUID 組查詢字串，筆數太多會超過 HTTP header 長度限制
  for (let i = 0; i < transactionIds.length; i += TXN_CHUNK) {
    const chunk = transactionIds.slice(i, i + TXN_CHUNK);
    const { data, error } = await supabase
      .from("official_transactions")
      .select(
        "id, address, district, transaction_date, total_price, unit_price, building_area_ping, floor_raw, geocode_status, geocode_match_status, geocode_source, raw_data"
      )
      .in("id", chunk)
      .eq("geocode_status", "resolved");
    if (error) throw error;
    for (const row of data as TransactionRow[]) transactionsById.set(row.id, row);
  }

  // 社區名稱來自 official_transaction_community_candidates（Community Matching 的正式寫入目標，
  // 見 schema.sql 981-983 行的設計註解），不是 official_transactions.community_id——那個欄位
  // 依設計不會被 Community Matching 寫入，避免配對邏輯重跑時要覆蓋交易原始資料。
  type CandidateRow = { official_transaction_id: string; community_id: string | null };
  const candidatesByTxnId = new Map<string, string>(); // txnId -> community_id（只存有 community_id 的）
  for (let i = 0; i < transactionIds.length; i += TXN_CHUNK) {
    const chunk = transactionIds.slice(i, i + TXN_CHUNK);
    const { data, error } = await supabase
      .from("official_transaction_community_candidates")
      .select("official_transaction_id, community_id")
      .in("official_transaction_id", chunk);
    if (error) throw error;
    for (const row of data as CandidateRow[]) {
      if (row.community_id) candidatesByTxnId.set(row.official_transaction_id, row.community_id);
    }
  }

  const communityIds = [...new Set([...candidatesByTxnId.values()])];
  const communityNameById = new Map<string, string>();
  if (communityIds.length > 0) {
    const { data, error } = await supabase.from("communities").select("id, name").in("id", communityIds);
    if (error) throw error;
    for (const row of data as { id: string; name: string }[]) communityNameById.set(row.id, row.name);
  }

  const matchesByTransaction = new Map<string, MatchRow[]>();
  for (const m of pendingMatches) {
    if (!transactionsById.has(m.official_transaction_id)) continue; // 交易還沒 resolved，先不列入
    const list = matchesByTransaction.get(m.official_transaction_id) ?? [];
    list.push(m);
    matchesByTransaction.set(m.official_transaction_id, list);
  }

  const events: NotificationEvent[] = [];
  for (const [txnId, txnMatches] of matchesByTransaction) {
    const txn = transactionsById.get(txnId);
    if (!txn) continue;
    events.push({
      officialTransactionId: txnId,
      address: txn.address,
      district: txn.district,
      transactionDate: txn.transaction_date,
      totalPrice: txn.total_price,
      unitPrice: txn.unit_price,
      buildingAreaPing: txn.building_area_ping,
      floorRaw: txn.floor_raw,
      floorNumber: parseChineseFloorLabel(txn.floor_raw),
      totalFloors: parseChineseFloorLabel(typeof txn.raw_data?.["總樓層數"] === "string" ? (txn.raw_data["總樓層數"] as string) : null),
      communityName: (() => {
        const communityId = candidatesByTxnId.get(txnId);
        return communityId ? communityNameById.get(communityId) ?? null : null;
      })(),
      geocodeStatus: txn.geocode_status,
      geocodeMatchStatus: txn.geocode_match_status,
      geocodeSource: txn.geocode_source,
      matchedAreas: txnMatches.map((m) => ({
        areaId: m.area_id,
        areaName: areaNameById.get(m.area_id) ?? "（未知區域）",
        matchedRuleIds: m.matched_rule_ids
      }))
    });
  }

  events.sort((a, b) => (b.transactionDate ?? "").localeCompare(a.transactionDate ?? ""));
  return events;
}

/**
 * 記錄「這筆交易×這些區域」已經透過某個通道成功送出通知。
 * 只能在真的確認發送成功（例如 LINE push API 回傳 200）之後才呼叫——這支函式本身
 * 不檢查有沒有真的發送，呼叫端要對這件事負責，失敗的情況絕對不能呼叫這支函式。
 */
export async function recordNotificationsSent(
  officialTransactionId: string,
  areaIds: string[],
  channel: "line"
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法記錄通知結果。");
  if (areaIds.length === 0) return;

  const rows = areaIds.map((areaId) => ({
    official_transaction_id: officialTransactionId,
    area_id: areaId,
    channel,
    notified_at: new Date().toISOString()
  }));
  const { error } = await supabase
    .from("official_transaction_area_notifications")
    .upsert(rows, { onConflict: "official_transaction_id,area_id", ignoreDuplicates: true });
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

// ==========================================================================
// 成交行情分類（物件用途 × 物件型態 → 成交行情分類）
// ==========================================================================

export type ProductCategory = {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

export type ProductCategoryRule = {
  id: string;
  categoryId: string | null;
  mainUsePattern: string;
  buildingTypePattern: string;
  needsReview: boolean;
};

type ProductCategoryRow = {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  is_active: boolean;
};

type ProductCategoryRuleRow = {
  id: string;
  category_id: string | null;
  main_use_pattern: string;
  source_building_type: string;
  needs_review: boolean;
};

function categoryFromRow(row: ProductCategoryRow): ProductCategory {
  return { id: row.id, key: row.key, label: row.label, sortOrder: row.sort_order, isActive: row.is_active };
}

function categoryRuleFromRow(row: ProductCategoryRuleRow): ProductCategoryRule {
  return {
    id: row.id,
    categoryId: row.category_id,
    mainUsePattern: row.main_use_pattern,
    buildingTypePattern: row.source_building_type,
    needsReview: row.needs_review
  };
}

export async function listProductCategories(): Promise<ProductCategory[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("product_categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as ProductCategoryRow[]).map(categoryFromRow);
}

export async function listProductCategoryRules(): Promise<ProductCategoryRule[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase.from("product_category_rules").select("*");
  if (error) throw error;
  return (data as ProductCategoryRuleRow[]).map(categoryRuleFromRow);
}

export type ClassifyResult = { categoryId: string | null; needsReview: boolean };

/**
 * 依「物件用途＋物件型態」查表得到成交行情分類。純函式，不查資料庫——
 * 呼叫端先把規則（listProductCategoryRules）撈出來傳進來，方便前端即時預覽分類結果
 * 而不用每打一個字就打一次 API。
 *
 * 比對邏輯：
 *   - 一條規則的 mainUsePattern／buildingTypePattern 若是空字串代表萬用，比對任何值；
 *     非空字串則必須完全相等才算命中。
 *   - 兩欄都命中才算這條規則「符合」；不比對子字串、不模糊比對——查不到就是查不到，不猜。
 *   - 符合的規則裡，兩欄都非萬用（比較具體）的規則優先於任一欄是萬用的規則。
 *   - 篩到最具體的一批規則後：剛好一條且 needsReview=false → 採用其分類；
 *     其餘情況（沒有規則命中、命中規則本身 needsReview=true、或命中多條指向不同分類）
 *     一律回傳 needsReview=true、categoryId=null。
 */
export function classifyDeal(
  mainUseInput: string,
  buildingTypeInput: string,
  rules: ProductCategoryRule[]
): ClassifyResult {
  const mainUse = mainUseInput.trim();
  const buildingType = buildingTypeInput.trim();

  const matched = rules.filter((rule) => {
    const mainUseOk = rule.mainUsePattern === "" || rule.mainUsePattern === mainUse;
    const buildingTypeOk = rule.buildingTypePattern === "" || rule.buildingTypePattern === buildingType;
    return mainUseOk && buildingTypeOk;
  });

  if (matched.length === 0) return { categoryId: null, needsReview: true };

  const specificity = (rule: ProductCategoryRule) =>
    (rule.mainUsePattern !== "" ? 1 : 0) + (rule.buildingTypePattern !== "" ? 1 : 0);
  const maxSpecificity = Math.max(...matched.map(specificity));
  const mostSpecific = matched.filter((rule) => specificity(rule) === maxSpecificity);

  if (mostSpecific.length !== 1) return { categoryId: null, needsReview: true };

  const rule = mostSpecific[0];
  if (rule.needsReview || !rule.categoryId) return { categoryId: null, needsReview: true };
  return { categoryId: rule.categoryId, needsReview: false };
}

// ==========================================================================
// 地圖範圍幾何比對工具函式
//
// 這兩個函式只負責「一個座標點在不在某個地圖範圍裡」這個單純的幾何問題，
// 純函式、不查資料庫。先備好給未來的「區域自動分類引擎」使用——那個引擎
// 本身（拿一筆交易的座標去跑過所有區域規則、決定 area_id）還沒有實作，
// 這裡只先把地圖範圍（bbox／polygon）這一層的判斷邏輯做好。
//
// 依已確認的優先順序設計：地圖範圍 > 社區 > 路段/地段/地址關鍵字 > 行政區（僅輔助）。
// ==========================================================================

export function isPointInBbox(lat: number, lng: number, bbox: Bbox): boolean {
  return lat <= bbox.north && lat >= bbox.south && lng <= bbox.east && lng >= bbox.west;
}

/**
 * 標準 ray-casting 演算法：從測試點往右畫一條射線，數這條線跟多邊形邊界交叉幾次，
 * 奇數次代表點在多邊形內。首尾點不用重複存，這裡用 (i, j=前一個索引) 的方式處理封閉。
 */
export function isPointInPolygon(lat: number, lng: number, polygon: Polygon): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    const intersects =
      pi.lat > lat !== pj.lat > lat &&
      lng < ((pj.lng - pi.lng) * (lat - pi.lat)) / (pj.lat - pi.lat) + pi.lng;
    if (intersects) inside = !inside;
  }
  return inside;
}
