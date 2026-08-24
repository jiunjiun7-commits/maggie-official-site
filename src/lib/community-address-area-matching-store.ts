import { getSupabaseClient } from "@/lib/supabase";
import { parseCommunityAddressKey } from "@/lib/community-address";
import { listAreas, listAreaRules, type AreaMatchRecomputeResult } from "@/lib/market-radar-store";

/**
 * Phase 10.5｜「community_addresses 門牌 → community → area」區域回推比對 service。
 *
 * 適用對象：沒有 bbox/polygon 規則、但底下的 communities 已經有明確 area_id 的區域
 * （目前指北美術／中美術／南美術）。既有 recomputeAreaMatches()（market-radar-store.ts）
 * 走的是「座標點是否落在 bbox/polygon 內」，這裡完全不同的判斷依據：一筆交易的地址
 * 解析出 (district, road, houseNumber) 後，直接查這個門牌在 community_addresses 裡
 * 是不是屬於這個區域底下的某個社區——不用任何座標，因為這批門牌資料本身就是已經
 * 逐戶核對過的正式資料，門牌本身就是最精確的邊界依據，不需要用地理座標做一次間接判斷。
 *
 * 寫入機制刻意沿用既有的 recompute_area_matches() Postgres function（schema.sql），
 * 這支 RPC 本來就是通用的「給一批 official_transaction_id + matched_rule_ids，安全 diff
 * 寫回 official_transaction_area_matches」，不管命中依據是座標還是門牌，寫入這一段完全一樣，
 * 不需要新增 RPC、不需要 Schema migration。matched_rule_ids 這裡不是真正的規則 id
 * （因為這幾個區域沒有 market_radar_area_rules 記錄），存一個固定字串
 * "community_address_match" 當標記，純粹是給既有 UI 顯示「命中依據」用，沒有 FK 約束。
 */

export type CommunityAddressAreaMatchResult = AreaMatchRecomputeResult & {
  communityCount: number;
  addressCount: number;
};

/**
 * @param areaId 目標區域 id（必須已經在 market_radar_areas 存在，且底下有 communities.area_id
 *   指向它的社區——這支函式不負責建立區域或回填 area_id，那是更上一層的職責）
 */
export async function recomputeCommunityAddressAreaMatches(areaId: string): Promise<CommunityAddressAreaMatchResult> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法重新計算門牌區域比對結果。");

  // 1. 找出這個區域底下的所有社區
  const { data: communityRows, error: communityError } = await supabase.from("communities").select("id").eq("area_id", areaId);
  if (communityError) throw communityError;
  const communityIds = (communityRows as { id: string }[]).map((c) => c.id);

  if (communityIds.length === 0) {
    // 這個區域底下沒有任何社區，合法情況（例如還沒回填），直接視為「這次沒有任何命中」，
    // 讓既有列全部被 diff 掉，不是錯誤。
    const { data: rpcData, error: rpcError } = await supabase.rpc("recompute_area_matches", { p_area_id: areaId, p_matches: [] });
    if (rpcError) throw rpcError;
    const result = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as
      | { inserted_count: number; deleted_count: number; updated_count: number; unchanged_count: number }
      | null;
    return {
      totalEligible: 0,
      matchedCount: 0,
      insertedCount: result?.inserted_count ?? 0,
      deletedCount: result?.deleted_count ?? 0,
      updatedCount: result?.updated_count ?? 0,
      unchangedCount: result?.unchanged_count ?? 0,
      communityCount: 0,
      addressCount: 0
    };
  }

  // 2. 撈這些社區底下全部的門牌（district+road+house_number 是比對 key）
  const CHUNK = 150;
  const addressKeySet = new Set<string>();
  const districtSet = new Set<string>();
  for (let i = 0; i < communityIds.length; i += CHUNK) {
    const chunk = communityIds.slice(i, i + CHUNK);
    const { data, error } = await supabase.from("community_addresses").select("district, road, house_number").in("community_id", chunk);
    if (error) throw error;
    for (const row of data as { district: string; road: string; house_number: string }[]) {
      addressKeySet.add(`${row.district}|${row.road}|${row.house_number}`);
      districtSet.add(row.district);
    }
  }

  // 3. 撈這些行政區底下全部的 official_transactions，逐筆解析地址、比對門牌 key
  //    （範圍限縮在這些門牌實際涵蓋的行政區，避免掃全高雄市 9,000+ 筆）
  let transactions: { id: string; address: string; district: string }[] = [];
  for (const district of districtSet) {
    const { data, error } = await supabase.from("official_transactions").select("id, address, district").eq("district", district);
    if (error) throw error;
    transactions = transactions.concat(data as { id: string; address: string; district: string }[]);
  }

  const matches: { official_transaction_id: string; matched_rule_ids: string[] }[] = [];
  for (const t of transactions) {
    const parsed = parseCommunityAddressKey(t.district, t.address);
    if (!parsed) continue;
    const key = `${parsed.district}|${parsed.road}|${parsed.houseNumber}`;
    if (addressKeySet.has(key)) {
      matches.push({ official_transaction_id: t.id, matched_rule_ids: ["community_address_match"] });
    }
  }

  // 4. 沿用既有 RPC 安全 diff 寫回
  const { data: rpcData, error: rpcError } = await supabase.rpc("recompute_area_matches", { p_area_id: areaId, p_matches: matches });
  if (rpcError) throw rpcError;
  const result = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as
    | { inserted_count: number; deleted_count: number; updated_count: number; unchanged_count: number }
    | null;

  return {
    totalEligible: transactions.length,
    matchedCount: matches.length,
    insertedCount: result?.inserted_count ?? 0,
    deletedCount: result?.deleted_count ?? 0,
    updatedCount: result?.updated_count ?? 0,
    unchangedCount: result?.unchanged_count ?? 0,
    communityCount: communityIds.length,
    addressCount: addressKeySet.size
  };
}

export type AllCommunityAddressAreaMatchResult = {
  areaResults: { areaId: string; areaName: string; result: CommunityAddressAreaMatchResult }[];
};

/**
 * Phase 10.8｜對「所有啟用中、沒有 bbox/polygon 地理規則、但底下有 communities.area_id
 * 指向它」的區域，各自呼叫一次 recomputeCommunityAddressAreaMatches()。
 *
 * 判斷依據完全不寫死區域名稱：
 *   1. 沒有任何有效 bbox/polygon 規則（有規則的區域交給 recomputeAllActiveAreaMatches()
 *      處理，兩邊互斥，不會重複跑同一個區域）
 *   2. 底下至少有 1 個 communities.area_id 指向它（沒有任何社區的區域代表這個機制目前
 *      沒有東西可比對，跳過，不是錯誤——例如「美術館」目前還是空殼區域）
 *
 * 未來如果再新增同類型（用門牌比對而非地理座標）的區域，只要幫它的 communities 設好
 * area_id，這裡會自動處理到，不需要改這支函式或加名稱清單。
 */
export async function recomputeAllCommunityAddressAreaMatches(): Promise<AllCommunityAddressAreaMatchResult> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法重新計算門牌區域比對結果。");

  const allAreas = await listAreas();
  const activeAreas = allAreas.filter((a) => a.isActive);

  const areaResults: { areaId: string; areaName: string; result: CommunityAddressAreaMatchResult }[] = [];
  for (const area of activeAreas) {
    const rules = await listAreaRules(area.id);
    const hasGeoRule = rules.some((r) => (r.ruleType === "bbox" && r.bbox) || (r.ruleType === "polygon" && r.polygon));
    if (hasGeoRule) continue; // 有地理規則，交給 recomputeAllActiveAreaMatches() 處理，這裡不重複跑

    const { count: communityCount } = await supabase.from("communities").select("id", { count: "exact", head: true }).eq("area_id", area.id);
    if (!communityCount) continue; // 這個區域底下沒有任何社區，沒有東西可比對，跳過不是錯誤

    const result = await recomputeCommunityAddressAreaMatches(area.id);
    areaResults.push({ areaId: area.id, areaName: area.name, result });
  }

  return { areaResults };
}
