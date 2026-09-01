import { getSupabaseClient } from "@/lib/supabase";

export type MarketCompetitorStatus = "available" | "price_cut" | "sold" | "delisted";

export type MarketCompetitor = {
  id: string;
  sellerId: string;
  platform: string;
  listingUrl: string;
  title: string;
  priceWan: number | null;
  note: string;
  status: MarketCompetitorStatus;
  createdAt: string; // 「加入追蹤時間」
  updatedAt: string;
};

type MarketCompetitorRow = {
  id: string;
  seller_id: string;
  platform: string;
  listing_url: string;
  title: string;
  price_wan: number | null;
  note: string;
  status: MarketCompetitorStatus;
  created_at: string;
  updated_at: string;
};

function fromRow(row: MarketCompetitorRow): MarketCompetitor {
  return {
    id: row.id,
    sellerId: row.seller_id,
    platform: row.platform,
    listingUrl: row.listing_url,
    title: row.title,
    priceWan: row.price_wan,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export type MarketCompetitorInput = {
  platform: string;
  listingUrl: string;
  title: string;
  priceWan: number | null;
  note: string;
  status: MarketCompetitorStatus;
};

function toRow(input: Partial<MarketCompetitorInput>) {
  const row: Record<string, unknown> = {};
  if (input.platform !== undefined) row.platform = input.platform;
  if (input.listingUrl !== undefined) row.listing_url = input.listingUrl;
  if (input.title !== undefined) row.title = input.title;
  if (input.priceWan !== undefined) row.price_wan = input.priceWan;
  if (input.note !== undefined) row.note = input.note;
  if (input.status !== undefined) row.status = input.status;
  return row;
}

export async function listMarketCompetitors(sellerId: string): Promise<MarketCompetitor[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("seller_market_competitors")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as MarketCompetitorRow[]).map(fromRow);
}

export async function createMarketCompetitor(
  sellerId: string,
  input: MarketCompetitorInput
): Promise<MarketCompetitor> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法新增競品。");

  const { data, error } = await supabase
    .from("seller_market_competitors")
    .insert({ ...toRow(input), seller_id: sellerId })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as MarketCompetitorRow);
}

/** 改價或改狀態時，先比對舊值再各寫一筆歷史紀錄，兩者都改就寫兩筆。 */
export async function updateMarketCompetitor(
  sellerId: string,
  competitorId: string,
  input: Partial<MarketCompetitorInput>
): Promise<MarketCompetitor | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法更新競品。");

  const { data: current, error: fetchError } = await supabase
    .from("seller_market_competitors")
    .select("price_wan, status")
    .eq("id", competitorId)
    .eq("seller_id", sellerId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!current) return null;

  const historyRows: { competitor_id: string; field: "price" | "status"; old_value: string | null; new_value: string }[] = [];
  if (input.priceWan !== undefined && input.priceWan !== current.price_wan) {
    historyRows.push({
      competitor_id: competitorId,
      field: "price",
      old_value: current.price_wan === null ? null : String(current.price_wan),
      new_value: input.priceWan === null ? "" : String(input.priceWan)
    });
  }
  if (input.status !== undefined && input.status !== current.status) {
    historyRows.push({
      competitor_id: competitorId,
      field: "status",
      old_value: current.status,
      new_value: input.status
    });
  }

  const { data, error } = await supabase
    .from("seller_market_competitors")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", competitorId)
    .eq("seller_id", sellerId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  if (historyRows.length) {
    const { error: historyError } = await supabase.from("seller_market_competitor_history").insert(historyRows);
    if (historyError) throw historyError;
  }

  return fromRow(data as MarketCompetitorRow);
}

/** 清單本身不是凍結歷史，允許刪除修正手誤——跟「週報不能刪除」是兩件事。 */
export async function deleteMarketCompetitor(sellerId: string, competitorId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法刪除競品。");

  const { error } = await supabase
    .from("seller_market_competitors")
    .delete()
    .eq("id", competitorId)
    .eq("seller_id", sellerId);
  if (error) throw error;
}

export type MarketCompetitorBadge = "new" | "price_cut" | "sold" | "delisted";

export type MarketCompetitorWithChange = MarketCompetitor & {
  /** 這筆在指定週期內偵測到的變化（依 sold > delisted > price_cut > new 優先序，最多顯示一個）。 */
  badge: MarketCompetitorBadge | null;
  priceDropWan?: number;
};

export type MarketStats = {
  available: number;
  newThisWeek: number;
  priceCutThisWeek: number;
  soldThisWeek: number;
};

/**
 * 給「新增/編輯週報」頁面在載入當下呼叫，算出統計數字與每筆競品在這個週期內的變化旗標，
 * 用來決定「本週摘要」的預設勾選跟徽章文字。新增報告時期間可能還沒實際填好，呼叫端可以先用
 * 「今天」當週期末的近似值；真正存進報告的內容仍然是使用者送出表單當下勾選的結果，不是這裡算出來就直接存檔。
 */
export async function buildMarketSnapshot(
  sellerId: string,
  periodStart: string,
  periodEnd: string
): Promise<{ stats: MarketStats; competitors: MarketCompetitorWithChange[] }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { stats: { available: 0, newThisWeek: 0, priceCutThisWeek: 0, soldThisWeek: 0 }, competitors: [] };

  const competitors = await listMarketCompetitors(sellerId);
  const periodStartIso = new Date(`${periodStart}T00:00:00.000Z`).toISOString();
  const periodEndIso = new Date(`${periodEnd}T23:59:59.999Z`).toISOString();

  const competitorIds = competitors.map((c) => c.id);
  let historyInPeriod: { competitor_id: string; field: "price" | "status"; old_value: string | null; new_value: string }[] = [];
  if (competitorIds.length) {
    const { data, error } = await supabase
      .from("seller_market_competitor_history")
      .select("competitor_id, field, old_value, new_value")
      .in("competitor_id", competitorIds)
      .gte("changed_at", periodStartIso)
      .lte("changed_at", periodEndIso);
    if (error) throw error;
    historyInPeriod = data as typeof historyInPeriod;
  }

  const result: MarketCompetitorWithChange[] = competitors.map((competitor) => {
    const isNew = competitor.createdAt >= periodStartIso && competitor.createdAt <= periodEndIso;

    const priceCuts = historyInPeriod.filter((h) => h.competitor_id === competitor.id && h.field === "price");
    let priceDropWan: number | undefined;
    for (const change of priceCuts) {
      const oldPrice = change.old_value ? Number(change.old_value) : null;
      const newPrice = change.new_value ? Number(change.new_value) : null;
      if (oldPrice !== null && newPrice !== null && newPrice < oldPrice) {
        priceDropWan = (priceDropWan ?? 0) + (oldPrice - newPrice);
      }
    }

    const soldThisWeek = historyInPeriod.some(
      (h) => h.competitor_id === competitor.id && h.field === "status" && h.new_value === "sold"
    );
    const delistedThisWeek = historyInPeriod.some(
      (h) => h.competitor_id === competitor.id && h.field === "status" && h.new_value === "delisted"
    );

    let badge: MarketCompetitorBadge | null = null;
    if (soldThisWeek) badge = "sold";
    else if (delistedThisWeek) badge = "delisted";
    else if (priceDropWan !== undefined) badge = "price_cut";
    else if (isNew) badge = "new";

    return { ...competitor, badge, priceDropWan };
  });

  const stats: MarketStats = {
    available: competitors.filter((c) => c.status === "available" || c.status === "price_cut").length,
    newThisWeek: result.filter((c) => c.badge === "new").length,
    priceCutThisWeek: result.filter((c) => c.badge === "price_cut").length,
    soldThisWeek: result.filter((c) => c.badge === "sold").length
  };

  return { stats, competitors: result };
}
