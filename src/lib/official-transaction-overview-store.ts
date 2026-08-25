import { getSupabaseClient } from "@/lib/supabase";
import { listAreas } from "@/lib/market-radar-store";
import { parseChineseFloorLabel } from "@/lib/chinese-numeral";

/**
 * Phase 10｜房市情報雷達後台總覽，讀取層。
 *
 * 範圍刻意界定為「已經命中至少一個監控區域的交易」（official_transaction_area_matches
 * 裡有記錄的那些），不是 official_transactions 整張表（9,000+ 筆涵蓋全高雄市，跟這個
 * 「監控區域雷達」的目的不符——列出跟妳監控範圍無關的地區資料只會製造雜訊）。
 * 「區域篩選：全部」的意思是「監控區域裡的全部」，不是「不分區域的全高雄市全部」。
 *
 * matchStatus 沿用 official_transaction_community_candidates 既有的四個值
 * （auto_matched/needs_confirmation/confirmed/no_community），額外定義 'not_matched'
 * 代表「已經命中監控區域，但 community matching 還沒處理過這筆」（例如 Cron 中途失敗，
 * 這種情況目前理論上不該發生，但畫面上要能誠實反映，不能假裝成別的狀態）。
 */

export type OfficialTransactionMatchStatus = "auto_matched" | "needs_confirmation" | "confirmed" | "no_community" | "not_matched";

export type OfficialTransactionOverviewRow = {
  id: string;
  address: string;
  district: string;
  transactionDate: string | null;
  totalPrice: number | null;
  unitPrice: number | null;
  buildingAreaPing: number | null;
  floorRaw: string;
  floorNumber: number | null;
  totalFloors: number | null;
  roomCount: number | null;
  hallCount: number | null;
  bathCount: number | null;
  createdAt: string;
  communityId: string | null;
  communityName: string | null;
  matchStatus: OfficialTransactionMatchStatus;
  matchedAreaNames: string[];
};

export type OfficialTransactionOverviewFilters = {
  areaId?: string;
  matchStatus?: OfficialTransactionMatchStatus;
  communitySearch?: string;
  addressSearch?: string;
  /**
   * Phase 11｜快速查行情用：單一關鍵字，社區名稱「或」地址任一比對到就算命中（OR，不是 AND）。
   * 跟 communitySearch／addressSearch（各自獨立、AND 疊加）是不同的查詢模式，兩者擇一使用——
   * 有給 keyword 時，忽略 communitySearch／addressSearch，避免語意衝突。
   */
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "created_at_desc" | "transaction_date_desc" | "unit_price_desc" | "total_price_desc";
  page?: number;
  pageSize?: number;
};

export type LatestSyncStatus = {
  status: "success" | "partial" | "failed" | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export type AreaDashboardStat = {
  areaId: string;
  areaName: string;
  totalCount: number;
  todayNewCount: number;
  last7DaysNewCount: number;
  latestTransaction: {
    communityName: string | null;
    address: string;
    transactionDate: string | null;
    totalPrice: number | null;
    unitPrice: number | null;
    buildingAreaPing: number | null;
    roomCount: number | null;
    hallCount: number | null;
    bathCount: number | null;
    floorNumber: number | null;
    totalFloors: number | null;
  } | null;
};

export type OfficialTransactionOverviewStats = {
  totalCount: number;
  todayNewCount: number;
  last7DaysNewCount: number;
  last30DaysNewCount: number;
  needsConfirmationCount: number;
};

type TxnRow = {
  id: string;
  address: string;
  district: string;
  transaction_date: string | null;
  total_price: number | null;
  unit_price: number | null;
  building_area_ping: number | null;
  floor_raw: string;
  created_at: string;
  raw_data: Record<string, unknown>;
};

const PAGE_SIZE = 1000;

/**
 * 格局（房/廳/衛）來源：official_transactions 目前沒有獨立欄位，只存在 raw_data 裡的官方
 * 原始欄位「建物現況格局-房」/「-廳」/「-衛」（確認過 35 筆監控範圍內全部有這三個 key，
 * 值都是數字字串），直接沿用官方原始數字，不做任何推算或猜測。key 不存在或不是合法數字時
 * 回傳 null（代表「這筆沒有格局資料」），呼叫端據此決定要不要顯示。
 */
function parseLayoutCount(rawValue: unknown): number | null {
  if (typeof rawValue !== "string" || rawValue.trim() === "") return null;
  const n = Number(rawValue.trim());
  return Number.isFinite(n) ? n : null;
}

async function fetchAllAreaMatches(): Promise<{ officialTransactionId: string; areaId: string }[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const rows: { officialTransactionId: string; areaId: string }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("official_transaction_area_matches")
      .select("official_transaction_id, area_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data as { official_transaction_id: string; area_id: string }[];
    rows.push(...page.map((r) => ({ officialTransactionId: r.official_transaction_id, areaId: r.area_id })));
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchAllCandidates(): Promise<Map<string, { matchStatus: OfficialTransactionMatchStatus; communityId: string | null }>> {
  const supabase = getSupabaseClient();
  const map = new Map<string, { matchStatus: OfficialTransactionMatchStatus; communityId: string | null }>();
  if (!supabase) return map;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("official_transaction_community_candidates")
      .select("official_transaction_id, community_id, match_status")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data as { official_transaction_id: string; community_id: string | null; match_status: OfficialTransactionMatchStatus }[];
    for (const r of page) map.set(r.official_transaction_id, { matchStatus: r.match_status, communityId: r.community_id });
    if (page.length < PAGE_SIZE) break;
  }
  return map;
}

async function fetchCommunityNames(): Promise<Map<string, string>> {
  const supabase = getSupabaseClient();
  const map = new Map<string, string>();
  if (!supabase) return map;
  const { data, error } = await supabase.from("communities").select("id, name");
  if (error) throw error;
  for (const row of data as { id: string; name: string }[]) map.set(row.id, row.name);
  return map;
}

/** 上方統計數字：固定以「監控區域內的全部交易」為範圍，不受列表篩選條件影響。 */
export async function getOfficialTransactionOverviewStats(): Promise<OfficialTransactionOverviewStats> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { totalCount: 0, todayNewCount: 0, last7DaysNewCount: 0, last30DaysNewCount: 0, needsConfirmationCount: 0 };
  }

  const areaMatches = await fetchAllAreaMatches();
  const txnIds = [...new Set(areaMatches.map((m) => m.officialTransactionId))];
  if (txnIds.length === 0) {
    return { totalCount: 0, todayNewCount: 0, last7DaysNewCount: 0, last30DaysNewCount: 0, needsConfirmationCount: 0 };
  }

  // 「今日／最近 7 天／最近 30 天新增」明確用 created_at（系統把這筆資料寫進 DB 的時間），
  // 不是 transaction_date（官方登記的實際交易日期）——這兩個是完全不同的概念，不能混用。
  // 台灣是 UTC+8、無日光節約時間，直接用固定 8 小時位移換算「今天」的邊界，不依賴伺服器時區設定。
  const nowUtc = new Date();
  const taipeiNow = new Date(nowUtc.getTime() + 8 * 60 * 60 * 1000);
  const taipeiTodayStr = taipeiNow.toISOString().slice(0, 10); // YYYY-MM-DD（台灣「今天」）
  const todayStartUtc = new Date(`${taipeiTodayStr}T00:00:00+08:00`);
  const sevenDaysAgoUtc = new Date(todayStartUtc.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoUtc = new Date(todayStartUtc.getTime() - 30 * 24 * 60 * 60 * 1000);

  let todayNewCount = 0;
  let last7DaysNewCount = 0;
  let last30DaysNewCount = 0;

  const CHUNK = 150;
  for (let i = 0; i < txnIds.length; i += CHUNK) {
    const chunk = txnIds.slice(i, i + CHUNK);
    const { data, error } = await supabase.from("official_transactions").select("id, created_at").in("id", chunk);
    if (error) throw error;
    for (const row of data as { id: string; created_at: string }[]) {
      const createdAt = new Date(row.created_at);
      if (createdAt >= todayStartUtc) todayNewCount++;
      if (createdAt >= sevenDaysAgoUtc) last7DaysNewCount++;
      if (createdAt >= thirtyDaysAgoUtc) last30DaysNewCount++;
    }
  }

  const candidates = await fetchAllCandidates();
  const needsConfirmationCount = txnIds.filter((id) => candidates.get(id)?.matchStatus === "needs_confirmation").length;

  return {
    totalCount: txnIds.length,
    todayNewCount,
    last7DaysNewCount,
    last30DaysNewCount,
    needsConfirmationCount
  };
}

/**
 * Phase 11｜情報作戰中心首頁只該顯示「真的有在監控」的區域，不是 market_radar_areas 裡
 * is_active=true 的全部（DB 現況裡還有 4 個當初 seed 但從沒接上任何比對機制的區域，例如
 * 美術館／中都重劃區，isActive=true 但沒有 bbox/polygon 規則、也沒有任何社區指派給它）。
 *
 * 判斷「是否真的有在監控」沿用 Phase 10.8 orchestration 已經在用的同一套定義（不猜、不用
 * 區域名稱字串判斷）：有至少一條有效 bbox/polygon 規則（地理型），或有至少一個
 * communities.area_id 指向它（門牌型）。這兩種都沒有的區域，代表目前還沒有任何比對機制
 * 會把交易分到它底下，永遠是 0 筆，放進首頁只會製造雜訊。
 */
export async function getMonitoredAreas(): Promise<{ id: string; name: string }[]> {
  const allAreas = await listAreas();
  const activeAreas = allAreas.filter((a) => a.isActive);
  const supabase = getSupabaseClient();
  if (!supabase || activeAreas.length === 0) return activeAreas.map((a) => ({ id: a.id, name: a.name }));

  const { data: rules, error: rulesErr } = await supabase.from("market_radar_area_rules").select("area_id, rule_type, bbox, polygon");
  if (rulesErr) throw rulesErr;
  const areaIdsWithGeoRule = new Set(
    (rules as { area_id: string; rule_type: string; bbox: unknown; polygon: unknown }[])
      .filter((r) => (r.rule_type === "bbox" && r.bbox) || (r.rule_type === "polygon" && r.polygon))
      .map((r) => r.area_id)
  );

  const { data: communityRows, error: communityErr } = await supabase.from("communities").select("area_id").not("area_id", "is", null);
  if (communityErr) throw communityErr;
  const areaIdsWithCommunities = new Set((communityRows as { area_id: string | null }[]).map((c) => c.area_id).filter((id): id is string => id !== null));

  return activeAreas.filter((a) => areaIdsWithGeoRule.has(a.id) || areaIdsWithCommunities.has(a.id)).map((a) => ({ id: a.id, name: a.name }));
}

/** Phase 11｜首頁「今日情報」用：最後一次同步的狀態與時間，直接讀 radar_sync_runs 最新一筆。 */
export async function getLatestSyncStatus(): Promise<LatestSyncStatus> {
  const supabase = getSupabaseClient();
  if (!supabase) return { status: null, startedAt: null, finishedAt: null };

  const { data, error } = await supabase.from("radar_sync_runs").select("status, started_at, finished_at").order("started_at", { ascending: false }).limit(1);
  if (error) throw error;
  const row = (data as { status: string; started_at: string; finished_at: string | null }[] | null)?.[0];
  if (!row) return { status: null, startedAt: null, finishedAt: null };
  return { status: row.status as LatestSyncStatus["status"], startedAt: row.started_at, finishedAt: row.finished_at };
}

/**
 * Phase 11｜首頁「今日情報」四區今日新增／「四大監控區域」卡片共用的來源：依區域分組統計
 * 累積筆數、今日新增、近 7 天新增、最近一筆成交（以系統新增時間 created_at 排序，跟
 * 「今日新增」用同一套時間定義，不是交易日期）。
 */
export async function getAreaDashboardStats(areas: { id: string; name: string }[]): Promise<AreaDashboardStat[]> {
  const supabase = getSupabaseClient();
  const empty = (): AreaDashboardStat[] =>
    areas.map((a) => ({ areaId: a.id, areaName: a.name, totalCount: 0, todayNewCount: 0, last7DaysNewCount: 0, latestTransaction: null }));
  if (!supabase) return empty();

  const areaMatches = await fetchAllAreaMatches();
  if (areaMatches.length === 0) return empty();

  const txnIdsByArea = new Map<string, string[]>();
  for (const area of areas) txnIdsByArea.set(area.id, []);
  for (const m of areaMatches) {
    if (txnIdsByArea.has(m.areaId)) txnIdsByArea.get(m.areaId)!.push(m.officialTransactionId);
  }

  const allTxnIds = [...new Set(areaMatches.map((m) => m.officialTransactionId))];

  const txnById = new Map<string, TxnRow>();
  const CHUNK = 150;
  for (let i = 0; i < allTxnIds.length; i += CHUNK) {
    const chunk = allTxnIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("official_transactions")
      .select("id, address, district, transaction_date, total_price, unit_price, building_area_ping, floor_raw, created_at, raw_data")
      .in("id", chunk);
    if (error) throw error;
    for (const row of data as TxnRow[]) txnById.set(row.id, row);
  }

  const candidates = await fetchAllCandidates();
  const communityNameById = await fetchCommunityNames();

  // 台灣是 UTC+8、無日光節約時間，跟 getOfficialTransactionOverviewStats 用同一套「今天」邊界算法。
  const nowUtc = new Date();
  const taipeiNow = new Date(nowUtc.getTime() + 8 * 60 * 60 * 1000);
  const taipeiTodayStr = taipeiNow.toISOString().slice(0, 10);
  const todayStartUtc = new Date(`${taipeiTodayStr}T00:00:00+08:00`);
  const sevenDaysAgoUtc = new Date(todayStartUtc.getTime() - 7 * 24 * 60 * 60 * 1000);

  return areas.map((area) => {
    const ids = txnIdsByArea.get(area.id) ?? [];
    let todayNewCount = 0;
    let last7DaysNewCount = 0;
    let latestRow: TxnRow | null = null;

    for (const id of ids) {
      const row = txnById.get(id);
      if (!row) continue;
      const createdAt = new Date(row.created_at);
      if (createdAt >= todayStartUtc) todayNewCount++;
      if (createdAt >= sevenDaysAgoUtc) last7DaysNewCount++;
      // 「最近成交」只從官方原始欄位 raw_data["主要用途"]==="住家用" 的交易裡挑，不含車位
      // （主要用途空字串）、商業／商辦／土地等特殊交易——不然一筆透天厝土地+建物商業交易
      // 換算出來的「單價」會是正常住宅的十幾倍，放在首頁會造成行情誤判（Phase 11 實測發現）。
      // 累積筆數／今日新增／近 7 天新增這幾個統計數字仍然算「監控範圍內全部」，不受這條篩選影響。
      if (row.raw_data?.["主要用途"] === "住家用" && (!latestRow || createdAt > new Date(latestRow.created_at))) latestRow = row;
    }

    let latestTransaction: AreaDashboardStat["latestTransaction"] = null;
    if (latestRow) {
      const candidate = candidates.get(latestRow.id);
      const communityId = candidate?.communityId ?? null;
      const totalFloorsRaw = typeof latestRow.raw_data?.["總樓層數"] === "string" ? (latestRow.raw_data["總樓層數"] as string) : null;
      latestTransaction = {
        communityName: communityId ? communityNameById.get(communityId) ?? null : null,
        address: latestRow.address,
        transactionDate: latestRow.transaction_date,
        totalPrice: latestRow.total_price,
        unitPrice: latestRow.unit_price,
        buildingAreaPing: latestRow.building_area_ping,
        roomCount: parseLayoutCount(latestRow.raw_data?.["建物現況格局-房"]),
        hallCount: parseLayoutCount(latestRow.raw_data?.["建物現況格局-廳"]),
        bathCount: parseLayoutCount(latestRow.raw_data?.["建物現況格局-衛"]),
        floorNumber: parseChineseFloorLabel(latestRow.floor_raw),
        totalFloors: parseChineseFloorLabel(totalFloorsRaw)
      };
    }

    return { areaId: area.id, areaName: area.name, totalCount: ids.length, todayNewCount, last7DaysNewCount, latestTransaction };
  });
}

export async function listOfficialTransactionsOverview(
  filters: OfficialTransactionOverviewFilters
): Promise<{ rows: OfficialTransactionOverviewRow[]; totalCount: number }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { rows: [], totalCount: 0 };

  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && filters.pageSize > 0 ? Math.min(filters.pageSize, 200) : 50;

  const [areaMatches, areas, candidates, communityNameById] = await Promise.all([
    fetchAllAreaMatches(),
    listAreas(),
    fetchAllCandidates(),
    fetchCommunityNames()
  ]);
  const areaNameById = new Map(areas.map((a) => [a.id, a.name]));

  const areaIdsByTxnId = new Map<string, string[]>();
  for (const m of areaMatches) {
    if (!areaIdsByTxnId.has(m.officialTransactionId)) areaIdsByTxnId.set(m.officialTransactionId, []);
    areaIdsByTxnId.get(m.officialTransactionId)!.push(m.areaId);
  }

  // ---------- scope 1：區域篩選 ----------
  let scopedTxnIds = [...areaIdsByTxnId.keys()];
  if (filters.areaId) {
    scopedTxnIds = scopedTxnIds.filter((id) => areaIdsByTxnId.get(id)!.includes(filters.areaId!));
  }

  // ---------- scope 2：社區配對狀態篩選 ----------
  if (filters.matchStatus) {
    scopedTxnIds = scopedTxnIds.filter((id) => {
      const c = candidates.get(id);
      const status: OfficialTransactionMatchStatus = c ? c.matchStatus : "not_matched";
      return status === filters.matchStatus;
    });
  }

  // ---------- scope 3：社區名稱搜尋，或 Phase 11 的 keyword 快速查行情（互斥：keyword 存在
  // 就不套用 communitySearch，語意不同——keyword 是「社區名 OR 地址」單一輸入框，
  // communitySearch 是既有篩選表單裡「只比對社區名」的獨立欄位，兩者不會同時被呼叫端傳入）。
  const keyword = filters.keyword?.trim();
  let keywordCommunityMatchIds: Set<string> | null = null;
  if (keyword) {
    const term = keyword.toLowerCase();
    const matchingCommunityIds = new Set([...communityNameById.entries()].filter(([, name]) => name.toLowerCase().includes(term)).map(([id]) => id));
    keywordCommunityMatchIds = new Set(
      scopedTxnIds.filter((id) => {
        const c = candidates.get(id);
        return c && c.communityId && matchingCommunityIds.has(c.communityId);
      })
    );
  } else if (filters.communitySearch && filters.communitySearch.trim()) {
    const term = filters.communitySearch.trim().toLowerCase();
    const matchingCommunityIds = new Set([...communityNameById.entries()].filter(([, name]) => name.toLowerCase().includes(term)).map(([id]) => id));
    scopedTxnIds = scopedTxnIds.filter((id) => {
      const c = candidates.get(id);
      return c && c.communityId && matchingCommunityIds.has(c.communityId);
    });
  }

  if (scopedTxnIds.length === 0) return { rows: [], totalCount: 0 };

  // ---------- scope 4：地址搜尋／keyword 地址比對／日期篩選（直接在 official_transactions 查詢層做） ----------
  let query = supabase.from("official_transactions").select("id, address, district, transaction_date, total_price, unit_price, building_area_ping, floor_raw, created_at, raw_data", {
    count: "exact"
  });

  // .in() 對筆數有實務上限，這裡的 scope 目前來自監控區域（現況遠小於 1000 筆），
  // 分批查詢再合併，不直接假設一次 .in() 一定夠用。
  const CHUNK = 150;
  let allMatchingIds: string[] = [];
  if (keyword) {
    // keyword 模式：地址比對到「或」社區名稱比對到（keywordCommunityMatchIds）都算命中，OR 合併。
    const addressMatchIds: string[] = [];
    for (let i = 0; i < scopedTxnIds.length; i += CHUNK) {
      const chunk = scopedTxnIds.slice(i, i + CHUNK);
      const { data, error } = await supabase.from("official_transactions").select("id").in("id", chunk).ilike("address", `%${keyword}%`);
      if (error) throw error;
      addressMatchIds.push(...(data as { id: string }[]).map((r) => r.id));
    }
    allMatchingIds = [...new Set([...addressMatchIds, ...(keywordCommunityMatchIds ?? [])])];
  } else if (filters.addressSearch && filters.addressSearch.trim()) {
    // 地址搜尋需要先在每個 chunk 內用 ilike 篩選，因為 .in() + .ilike() 要同時套用在同一批 id 上。
    for (let i = 0; i < scopedTxnIds.length; i += CHUNK) {
      const chunk = scopedTxnIds.slice(i, i + CHUNK);
      let chunkQuery = supabase.from("official_transactions").select("id").in("id", chunk).ilike("address", `%${filters.addressSearch.trim()}%`);
      const { data, error } = await chunkQuery;
      if (error) throw error;
      allMatchingIds.push(...(data as { id: string }[]).map((r) => r.id));
    }
  } else {
    allMatchingIds = scopedTxnIds;
  }

  if (allMatchingIds.length === 0) return { rows: [], totalCount: 0 };

  query = query.in("id", allMatchingIds);
  if (filters.dateFrom) query = query.gte("transaction_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("transaction_date", filters.dateTo);

  switch (filters.sortBy) {
    case "transaction_date_desc":
      query = query.order("transaction_date", { ascending: false, nullsFirst: false });
      break;
    case "unit_price_desc":
      query = query.order("unit_price", { ascending: false, nullsFirst: false });
      break;
    case "total_price_desc":
      query = query.order("total_price", { ascending: false, nullsFirst: false });
      break;
    case "created_at_desc":
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  const fromIdx = (page - 1) * pageSize;
  query = query.range(fromIdx, fromIdx + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows: OfficialTransactionOverviewRow[] = (data as TxnRow[]).map((t) => {
    const candidate = candidates.get(t.id);
    const communityId = candidate?.communityId ?? null;
    const matchStatus: OfficialTransactionMatchStatus = candidate ? candidate.matchStatus : "not_matched";
    const totalFloorsRaw = typeof t.raw_data?.["總樓層數"] === "string" ? (t.raw_data["總樓層數"] as string) : null;

    return {
      id: t.id,
      address: t.address,
      district: t.district,
      transactionDate: t.transaction_date,
      totalPrice: t.total_price,
      unitPrice: t.unit_price,
      buildingAreaPing: t.building_area_ping,
      floorRaw: t.floor_raw,
      floorNumber: parseChineseFloorLabel(t.floor_raw),
      totalFloors: parseChineseFloorLabel(totalFloorsRaw),
      roomCount: parseLayoutCount(t.raw_data?.["建物現況格局-房"]),
      hallCount: parseLayoutCount(t.raw_data?.["建物現況格局-廳"]),
      bathCount: parseLayoutCount(t.raw_data?.["建物現況格局-衛"]),
      createdAt: t.created_at,
      communityId,
      communityName: communityId ? communityNameById.get(communityId) ?? null : null,
      matchStatus,
      matchedAreaNames: (areaIdsByTxnId.get(t.id) ?? []).map((id) => areaNameById.get(id) ?? "（未知區域）")
    };
  });

  return { rows, totalCount: count ?? rows.length };
}
