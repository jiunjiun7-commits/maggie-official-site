import { getSupabaseClient } from "@/lib/supabase";
import type { PromotionPhoto } from "@/lib/seller-report-store";

/**
 * 銷售紀錄。
 *
 * 一筆紀錄＝「某一天的一件事」，不是「一位客戶」——這個系統的核心是屋主週報，
 * 不是買方 CRM。所以沒有客戶姓名、沒有狀態流程，只有「哪一天、幾組、回饋摘要」。
 * 輸入流程刻意壓到：日期 → 組數 → 摘要 →（選填照片）→ 存。
 */

export type SalesRecordKind = "viewing" | "appointment" | "inquiry" | "peer_feedback" | "promotion" | "other";

export const SALES_RECORD_KINDS: { key: SalesRecordKind; label: string; hasGroups: boolean }[] = [
  { key: "viewing", label: "實際帶看", hasGroups: true },
  { key: "appointment", label: "已安排帶看", hasGroups: true },
  { key: "inquiry", label: "客戶詢問", hasGroups: true },
  { key: "peer_feedback", label: "同業回饋", hasGroups: false },
  { key: "promotion", label: "推廣紀錄", hasGroups: false },
  { key: "other", label: "其他", hasGroups: false }
];

export function kindLabel(kind: SalesRecordKind): string {
  return SALES_RECORD_KINDS.find((k) => k.key === kind)?.label ?? "紀錄";
}

export function kindHasGroups(kind: SalesRecordKind): boolean {
  return SALES_RECORD_KINDS.find((k) => k.key === kind)?.hasGroups ?? false;
}

export type SalesRecord = {
  id: string;
  sellerId: string;
  kind: SalesRecordKind;
  /** 只有日期（YYYY-MM-DD）。「已安排帶看」存的是預計看屋日期。 */
  occurredOn: string;
  /** 帶看／詢問類的組數；其他類型是 null。 */
  groupCount: number | null;
  summary: string;
  internalNote: string;
  photos: PromotionPhoto[];
  visibleToOwner: boolean;
  createdAt: string;
  updatedAt: string;
};

type SalesRecordRow = {
  id: string;
  seller_id: string;
  kind: SalesRecordKind;
  occurred_on: string;
  group_count: number | null;
  summary: string;
  internal_note: string;
  photos: PromotionPhoto[];
  visible_to_owner: boolean;
  created_at: string;
  updated_at: string;
};

function fromRow(row: SalesRecordRow): SalesRecord {
  return {
    id: row.id,
    sellerId: row.seller_id,
    kind: row.kind,
    occurredOn: row.occurred_on,
    groupCount: row.group_count,
    summary: row.summary,
    internalNote: row.internal_note,
    photos: row.photos || [],
    visibleToOwner: row.visible_to_owner,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export type SalesRecordInput = {
  kind: SalesRecordKind;
  occurredOn: string;
  groupCount: number | null;
  summary: string;
  internalNote: string;
  photos: PromotionPhoto[];
  visibleToOwner: boolean;
};

function toRow(input: Partial<SalesRecordInput>) {
  const row: Record<string, unknown> = {};
  if (input.kind !== undefined) row.kind = input.kind;
  if (input.occurredOn !== undefined) row.occurred_on = input.occurredOn;
  if (input.groupCount !== undefined) row.group_count = input.groupCount;
  if (input.summary !== undefined) row.summary = input.summary;
  if (input.internalNote !== undefined) row.internal_note = input.internalNote;
  if (input.photos !== undefined) row.photos = input.photos;
  if (input.visibleToOwner !== undefined) row.visible_to_owner = input.visibleToOwner;
  return row;
}

export async function listSalesRecords(sellerId: string): Promise<SalesRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("seller_sales_records")
    .select("*")
    .eq("seller_id", sellerId)
    .order("occurred_on", { ascending: false });
  if (error) throw error;
  return (data as SalesRecordRow[]).map(fromRow);
}

export async function createSalesRecord(sellerId: string, input: SalesRecordInput): Promise<SalesRecord> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法新增紀錄。");

  const { data, error } = await supabase
    .from("seller_sales_records")
    .insert({ ...toRow(input), seller_id: sellerId })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as SalesRecordRow);
}

export async function updateSalesRecord(
  sellerId: string,
  recordId: string,
  input: Partial<SalesRecordInput>
): Promise<SalesRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法更新紀錄。");

  const { data, error } = await supabase
    .from("seller_sales_records")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", recordId)
    .eq("seller_id", sellerId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as SalesRecordRow) : null;
}

export async function deleteSalesRecord(sellerId: string, recordId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法刪除紀錄。");

  const { error } = await supabase
    .from("seller_sales_records")
    .delete()
    .eq("id", recordId)
    .eq("seller_id", sellerId);
  if (error) throw error;
}

/* ---------- 週報快照 ---------- */

export type SalesStats = {
  /** 本週詢問組數（加總，不是筆數） */
  inquiryGroups: number;
  /** 本週實際帶看組數 */
  viewingGroups: number;
  /** 累積實際帶看組數＝案件期初累積值＋系統紀錄加總 */
  viewingGroupsTotal: number;
};

export type SalesSnapshotItem = {
  recordId: string;
  kind: SalesRecordKind;
  label: string;
  occurredOn: string;
  groupCount: number | null;
  summary: string;
  photos: PromotionPhoto[];
};

export type SalesSnapshot = {
  stats: SalesStats;
  items: SalesSnapshotItem[];
};

export function emptySalesStats(): SalesStats {
  return { inquiryGroups: 0, viewingGroups: 0, viewingGroupsTotal: 0 };
}

function sumGroups(records: SalesRecord[]): number {
  return records.reduce((total, r) => total + (r.groupCount ?? 0), 0);
}

/**
 * 「已安排帶看」還該不該讓屋主看到。
 *
 * 這是預告性質的資訊，兩種情況就不該再顯示，避免屋主把同一批客戶看成兩批：
 * 1. 同一天已經有「實際帶看」紀錄——實際的取代預計的。
 * 2. 預計日期已經過了——要嘛已經發生（會有實際帶看紀錄），要嘛沒成行，
 *    兩種情況都不該再跟屋主說「即將帶看」。
 *
 * 刻意不用「已完成」勾選框：多一個要記得按的步驟，忘了按就會顯示錯的資訊。
 */
export function isAppointmentStillUpcoming(
  record: SalesRecord,
  allRecords: SalesRecord[],
  asOf: string
): boolean {
  if (record.kind !== "appointment") return true;
  if (record.occurredOn < asOf) return false;
  const supersededByActual = allRecords.some(
    (r) => r.kind === "viewing" && r.occurredOn === record.occurredOn
  );
  return !supersededByActual;
}

/** 這種紀錄可不可以逐筆顯示給屋主。詢問只進統計，不逐筆列（列出來沒有資訊量）。 */
export function isListableForOwner(record: SalesRecord): boolean {
  return record.kind !== "inquiry";
}

/** 這筆紀錄落在這個報告週期內嗎。 */
export function isRecordInPeriod(record: SalesRecord, periodStart: string, periodEnd: string) {
  return record.occurredOn >= periodStart && record.occurredOn <= periodEnd;
}

/**
 * 「已安排帶看」是預告未來的事，日期本來就會落在報告週期之後，
 * 用一般的週期判斷會被濾掉，所以另外判斷。
 */
export function isUpcomingAppointment(record: SalesRecord, periodEnd: string) {
  return record.kind === "appointment" && record.occurredOn >= periodEnd;
}

export function toSnapshotItem(record: SalesRecord): SalesSnapshotItem {
  return {
    recordId: record.id,
    kind: record.kind,
    label: kindLabel(record.kind),
    occurredOn: record.occurredOn,
    groupCount: record.groupCount,
    summary: record.summary,
    photos: record.photos
    // 註：internalNote 刻意不複製，屋主端沒有任何管道讀到。
  };
}

/**
 * 算出這個報告週期的統計，並回傳全部紀錄讓表單決定要放哪幾筆。
 * 跟競品追蹤 buildMarketSnapshot() 同一種模式：平常記錄 → 建立週報當下凍結成快照。
 */
export async function buildSalesSnapshot(
  sellerId: string,
  periodStart: string,
  periodEnd: string,
  baseline: { viewings: number }
): Promise<{ stats: SalesStats; records: SalesRecord[] }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { stats: emptySalesStats(), records: [] };

  const records = await listSalesRecords(sellerId);
  const inPeriod = records.filter((r) => isRecordInPeriod(r, periodStart, periodEnd));

  const stats: SalesStats = {
    inquiryGroups: sumGroups(inPeriod.filter((r) => r.kind === "inquiry")),
    viewingGroups: sumGroups(inPeriod.filter((r) => r.kind === "viewing")),
    viewingGroupsTotal:
      baseline.viewings + sumGroups(records.filter((r) => r.kind === "viewing" && r.occurredOn <= periodEnd))
  };

  return { stats, records };
}
