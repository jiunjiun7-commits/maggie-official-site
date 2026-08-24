import { getSupabaseClient } from "@/lib/supabase";
import { parseCommunityAddressKey, isClearlyNonCommunityType } from "@/lib/community-address";

/**
 * Community Matching 正式 service（Phase 8.5，取代原本只存在於一次性腳本裡的比對/寫入邏輯）。
 *
 * 寫入目標固定是 official_transaction_community_candidates（unique(official_transaction_id)），
 * 語意沿用 schema.sql 981-983 行的既有設計：這張表獨立存配對狀態，不覆蓋
 * official_transactions 原始資料，配對邏輯本來就設計成「可以隨時重跑」。
 *
 * 決定性比對規則（跟 Phase 5 完全一致，只是從一次性腳本搬進正式 service）：
 *   1. isClearlyNonCommunityType(building_type_raw) 為 true -> no_community，community_id=null
 *   2. parseCommunityAddressKey() 解析失敗，或解析出的 (district,road,houseNumber) 在
 *      community_addresses 找不到任何對應、或對應到 >1 個不同社區（理論上不會發生，
 *      unique constraint 保護，但仍防禦性處理）-> needs_confirmation，community_id=null
 *      （地址解析失敗跟「找不到對應社區」都代表「無法自動判斷、需要人工看」，
 *      不強行區分成兩種狀態，因為 schema 的 match_status enum 本來就沒有 parse_failed 這個值，
 *      不新增列舉值，沿用既有 4 個狀態）
 *   3. 找到唯一對應的社區 -> auto_matched，community_id=該社區
 *
 * Idempotent 合併規則（這是本次要修的核心）：
 *   - 沒有既有 candidate -> insert
 *   - 既有 match_status='confirmed'（人工確認過）-> 永遠不自動覆蓋，只回報
 *     unchanged/skipped_confirmed，如果新算出的結果跟人工確認的不一樣，額外記一筆 conflict
 *     供人工看，不自動改
 *   - 既有 match_status 是 auto_matched/needs_confirmation/no_community 這三種「非人工確認」
 *     狀態 -> 可以安全依最新計算結果 update；如果算出來的結果跟現有一模一樣（community_id 與
 *     match_status都相同）就算 unchanged，不多送一次 UPDATE
 */

type TxnForMatching = {
  id: string;
  address: string;
  district: string;
  building_type_raw: string | null;
};

type ExistingCandidate = {
  official_transaction_id: string;
  community_id: string | null;
  match_status: "auto_matched" | "needs_confirmation" | "confirmed" | "no_community";
};

export type ComputedMatch = {
  officialTransactionId: string;
  communityId: string | null;
  matchStatus: "auto_matched" | "needs_confirmation" | "no_community";
  matchReason: Record<string, unknown>;
};

export type CommunityMatchConflict = {
  officialTransactionId: string;
  existingCommunityId: string | null;
  computedCommunityId: string | null;
  computedMatchStatus: string;
  reason: string;
};

export type CommunityMatchRecomputeResult = {
  total: number;
  inserted: number;
  updated: number;
  unchanged: number;
  autoMatched: number;
  needsConfirmation: number;
  noCommunity: number;
  skippedConfirmed: number;
  conflicts: CommunityMatchConflict[];
  errors: { officialTransactionId: string; message: string }[];
};

/** 純函式：依 district/address/building_type_raw 與現有 community_addresses 索引，算出決定性配對結果。 */
function computeDeterministicMatch(
  txn: TxnForMatching,
  communityIdsByAddrKey: Map<string, string[]>
): Omit<ComputedMatch, "officialTransactionId"> {
  if (isClearlyNonCommunityType(txn.building_type_raw)) {
    return {
      communityId: null,
      matchStatus: "no_community",
      matchReason: { rule: "isClearlyNonCommunityType", buildingTypeRaw: txn.building_type_raw }
    };
  }

  const parsed = parseCommunityAddressKey(txn.district, txn.address);
  if (!parsed) {
    return {
      communityId: null,
      matchStatus: "needs_confirmation",
      matchReason: { rule: "parse_failed", note: "parseCommunityAddressKey() 無法解析出路名＋門牌號＋號格式" }
    };
  }

  const key = `${parsed.district}|${parsed.road}|${parsed.houseNumber}`;
  const matchedCommunityIds = Array.from(new Set(communityIdsByAddrKey.get(key) ?? []));

  if (matchedCommunityIds.length === 0) {
    return {
      communityId: null,
      matchStatus: "needs_confirmation",
      matchReason: { rule: "no_community_address_mapping", district: parsed.district, road: parsed.road, houseNumber: parsed.houseNumber }
    };
  }

  if (matchedCommunityIds.length > 1) {
    return {
      communityId: null,
      matchStatus: "needs_confirmation",
      matchReason: {
        rule: "ambiguous_community_address_mapping",
        district: parsed.district,
        road: parsed.road,
        houseNumber: parsed.houseNumber,
        candidateCommunityIds: matchedCommunityIds
      }
    };
  }

  return {
    communityId: matchedCommunityIds[0],
    matchStatus: "auto_matched",
    matchReason: { rule: "unique_community_address_match", district: parsed.district, road: parsed.road, houseNumber: parsed.houseNumber }
  };
}

/**
 * 對指定的 official_transaction_id 清單重新計算 Community Matching，並安全寫回
 * official_transaction_community_candidates（idempotent，可安全重跑任意次數）。
 *
 * 呼叫端負責決定要處理哪些交易（例如「這次區域比對新命中的交易」），這支函式本身
 * 不會自己去查「所有命中區域的交易」——保持職責單純，方便之後接進 orchestration。
 */
export async function recomputeCommunityMatches(officialTransactionIds: string[]): Promise<CommunityMatchRecomputeResult> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法重新計算 Community Matching。");

  const result: CommunityMatchRecomputeResult = {
    total: officialTransactionIds.length,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    autoMatched: 0,
    needsConfirmation: 0,
    noCommunity: 0,
    skippedConfirmed: 0,
    conflicts: [],
    errors: []
  };
  if (officialTransactionIds.length === 0) return result;

  const CHUNK = 150;

  // 1. 撈交易資料（只取比對需要的欄位）
  let transactions: TxnForMatching[] = [];
  for (let i = 0; i < officialTransactionIds.length; i += CHUNK) {
    const chunk = officialTransactionIds.slice(i, i + CHUNK);
    const { data, error } = await supabase.from("official_transactions").select("id, address, district, building_type_raw").in("id", chunk);
    if (error) throw error;
    transactions = transactions.concat(data as TxnForMatching[]);
  }
  const transactionsById = new Map(transactions.map((t) => [t.id, t]));

  // 2. 撈既有 candidate 記錄（決定 insert/update/unchanged/skipped_confirmed 的關鍵依據）
  let existingCandidates: ExistingCandidate[] = [];
  for (let i = 0; i < officialTransactionIds.length; i += CHUNK) {
    const chunk = officialTransactionIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("official_transaction_community_candidates")
      .select("official_transaction_id, community_id, match_status")
      .in("official_transaction_id", chunk);
    if (error) throw error;
    existingCandidates = existingCandidates.concat(data as ExistingCandidate[]);
  }
  const existingByTxnId = new Map(existingCandidates.map((c) => [c.official_transaction_id, c]));

  // 3. 撈全部 community_addresses 建索引（沿用既有 Phase 5 的作法：district+road+house_number -> community_id[]）
  const communityIdsByAddrKey = new Map<string, string[]>();
  {
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from("community_addresses").select("community_id, district, road, house_number").range(from, from + PAGE - 1);
      if (error) throw error;
      const page = data as { community_id: string; district: string; road: string; house_number: string }[];
      for (const a of page) {
        const key = `${a.district}|${a.road}|${a.house_number}`;
        if (!communityIdsByAddrKey.has(key)) communityIdsByAddrKey.set(key, []);
        communityIdsByAddrKey.get(key)!.push(a.community_id);
      }
      if (page.length < PAGE) break;
    }
  }

  // 4. 逐筆決定 insert / update / unchanged / skipped_confirmed
  const toInsert: { official_transaction_id: string; community_id: string | null; match_status: string; match_reason: Record<string, unknown> }[] = [];
  const toUpdate: { official_transaction_id: string; community_id: string | null; match_status: string; match_reason: Record<string, unknown> }[] = [];

  for (const id of officialTransactionIds) {
    try {
      const txn = transactionsById.get(id);
      if (!txn) {
        result.errors.push({ officialTransactionId: id, message: "official_transactions 裡找不到這筆交易" });
        continue;
      }

      const computed = computeDeterministicMatch(txn, communityIdsByAddrKey);
      if (computed.matchStatus === "auto_matched") result.autoMatched++;
      else if (computed.matchStatus === "needs_confirmation") result.needsConfirmation++;
      else result.noCommunity++;

      const existing = existingByTxnId.get(id);

      if (!existing) {
        toInsert.push({ official_transaction_id: id, community_id: computed.communityId, match_status: computed.matchStatus, match_reason: computed.matchReason });
        continue;
      }

      if (existing.match_status === "confirmed") {
        result.skippedConfirmed++;
        result.unchanged++;
        if (existing.community_id !== computed.communityId) {
          result.conflicts.push({
            officialTransactionId: id,
            existingCommunityId: existing.community_id,
            computedCommunityId: computed.communityId,
            computedMatchStatus: computed.matchStatus,
            reason: "既有人工 confirmed 結果與最新自動比對結果不同，保留 confirmed，不自動覆蓋。"
          });
        }
        continue;
      }

      const identical = existing.community_id === computed.communityId && existing.match_status === computed.matchStatus;
      if (identical) {
        result.unchanged++;
        continue;
      }

      toUpdate.push({ official_transaction_id: id, community_id: computed.communityId, match_status: computed.matchStatus, match_reason: computed.matchReason });
    } catch (err) {
      result.errors.push({ officialTransactionId: id, message: err instanceof Error ? err.message : String(err) });
    }
  }

  // 5. 寫入：insert 用一般 insert（這些 official_transaction_id 這裡確定沒有既有記錄）；
  //    update 逐筆 update（不是批次 upsert，避免任何一筆意外覆蓋到沒被讀到的 confirmed 記錄）。
  if (toInsert.length > 0) {
    const { error } = await supabase.from("official_transaction_community_candidates").insert(toInsert);
    if (error) throw error;
    result.inserted += toInsert.length;
  }

  for (const row of toUpdate) {
    const { error } = await supabase
      .from("official_transaction_community_candidates")
      .update({ community_id: row.community_id, match_status: row.match_status, match_reason: row.match_reason })
      .eq("official_transaction_id", row.official_transaction_id)
      .neq("match_status", "confirmed"); // 雙重保險：即使前面判斷有誤，也不可能真的 UPDATE 掉 confirmed 那筆
    if (error) throw error;
    result.updated++;
  }

  return result;
}
