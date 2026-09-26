import { getSupabaseClient } from "@/lib/supabase";
import type { PromotionPhoto } from "@/lib/seller-report-store";

/**
 * 客戶／銷售紀錄。
 *
 * 設計重點：一位客戶＝一筆紀錄，狀態往前推進，不是每個階段開一筆新的——
 * 這樣「詢問→追蹤中→已約帶看→實際帶看」整條龍只輸入一次，週報直接拿來用。
 */

export type CustomerRecordKind = "customer" | "peer_feedback" | "promotion" | "other";

/** 只有 kind='customer' 會用到狀態流程；其餘三類固定停在預設值，畫面上也不顯示狀態。 */
export type CustomerRecordStatus = "inquiry" | "tracking" | "appointed" | "viewed" | "closed";

export const CUSTOMER_RECORD_KINDS: { key: CustomerRecordKind; label: string }[] = [
  { key: "customer", label: "客戶" },
  { key: "peer_feedback", label: "同業回饋" },
  { key: "promotion", label: "推廣紀錄" },
  { key: "other", label: "其他" }
];

export const CUSTOMER_RECORD_STATUSES: { key: CustomerRecordStatus; label: string }[] = [
  { key: "inquiry", label: "詢問" },
  { key: "tracking", label: "追蹤中" },
  { key: "appointed", label: "已約帶看" },
  { key: "viewed", label: "實際帶看" },
  { key: "closed", label: "結束追蹤" }
];

/** 「追蹤中」＝目前仍有後續可能性的客戶，不限本週新增。已約帶看也還在追蹤範圍內。 */
const TRACKING_STATUSES: CustomerRecordStatus[] = ["tracking", "appointed"];

export type CustomerRecord = {
  id: string;
  sellerId: string;
  kind: CustomerRecordKind;
  status: CustomerRecordStatus;
  inquiredAt: string | null;
  viewedAt: string | null;
  occurredAt: string | null;
  customerAlias: string;
  feedback: string;
  internalNote: string;
  photos: PromotionPhoto[];
  visibleToOwner: boolean;
  createdAt: string;
  updatedAt: string;
};

type CustomerRecordRow = {
  id: string;
  seller_id: string;
  kind: CustomerRecordKind;
  status: CustomerRecordStatus;
  inquired_at: string | null;
  viewed_at: string | null;
  occurred_at: string | null;
  customer_alias: string;
  feedback: string;
  internal_note: string;
  photos: PromotionPhoto[];
  visible_to_owner: boolean;
  created_at: string;
  updated_at: string;
};

function fromRow(row: CustomerRecordRow): CustomerRecord {
  return {
    id: row.id,
    sellerId: row.seller_id,
    kind: row.kind,
    status: row.status,
    inquiredAt: row.inquired_at,
    viewedAt: row.viewed_at,
    occurredAt: row.occurred_at,
    customerAlias: row.customer_alias,
    feedback: row.feedback,
    internalNote: row.internal_note,
    photos: row.photos || [],
    visibleToOwner: row.visible_to_owner,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export type CustomerRecordInput = {
  kind: CustomerRecordKind;
  status: CustomerRecordStatus;
  inquiredAt: string | null;
  viewedAt: string | null;
  occurredAt: string | null;
  customerAlias: string;
  feedback: string;
  internalNote: string;
  photos: PromotionPhoto[];
  visibleToOwner: boolean;
};

function toRow(input: Partial<CustomerRecordInput>) {
  const row: Record<string, unknown> = {};
  if (input.kind !== undefined) row.kind = input.kind;
  if (input.status !== undefined) row.status = input.status;
  if (input.inquiredAt !== undefined) row.inquired_at = input.inquiredAt;
  if (input.viewedAt !== undefined) row.viewed_at = input.viewedAt;
  if (input.occurredAt !== undefined) row.occurred_at = input.occurredAt;
  if (input.customerAlias !== undefined) row.customer_alias = input.customerAlias;
  if (input.feedback !== undefined) row.feedback = input.feedback;
  if (input.internalNote !== undefined) row.internal_note = input.internalNote;
  if (input.photos !== undefined) row.photos = input.photos;
  if (input.visibleToOwner !== undefined) row.visible_to_owner = input.visibleToOwner;
  return row;
}

export async function listCustomerRecords(sellerId: string): Promise<CustomerRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("seller_customer_records")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as CustomerRecordRow[]).map(fromRow);
}

export async function createCustomerRecord(
  sellerId: string,
  input: CustomerRecordInput
): Promise<CustomerRecord> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法新增紀錄。");

  const { data, error } = await supabase
    .from("seller_customer_records")
    .insert({ ...toRow(input), seller_id: sellerId })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as CustomerRecordRow);
}

export async function updateCustomerRecord(
  sellerId: string,
  recordId: string,
  input: Partial<CustomerRecordInput>
): Promise<CustomerRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法更新紀錄。");

  const { data, error } = await supabase
    .from("seller_customer_records")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", recordId)
    .eq("seller_id", sellerId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as CustomerRecordRow) : null;
}

export async function deleteCustomerRecord(sellerId: string, recordId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("尚未設定 Supabase，無法刪除紀錄。");

  const { error } = await supabase
    .from("seller_customer_records")
    .delete()
    .eq("id", recordId)
    .eq("seller_id", sellerId);
  if (error) throw error;
}

/* ---------- 週報快照 ---------- */

export type CustomerStats = {
  inquiriesWeek: number;
  /** 目前仍在追蹤的客戶數（不限本週新增），跟其他三個「本週」數字語意不同。 */
  tracking: number;
  viewingsWeek: number;
  inquiriesTotal: number;
  viewingsTotal: number;
};

/**
 * 會寫進週報、屋主看得到的單筆內容。
 * 刻意只有這幾個欄位——customerAlias 與 internalNote 從來不會被複製進來，
 * 所以屋主端連讀都讀不到，不是靠畫面隱藏。
 */
export type CustomerSnapshotItem = {
  recordId: string;
  kind: CustomerRecordKind;
  /** 顯示用標籤，例如「實際帶看」「同業回饋」。 */
  label: string;
  /** ISO 時間字串，Portal 顯示成 09/24。 */
  occurredAt: string;
  feedback: string;
  photos: PromotionPhoto[];
};

export type CustomerSnapshot = {
  stats: CustomerStats;
  items: CustomerSnapshotItem[];
};

export function emptyCustomerStats(): CustomerStats {
  return { inquiriesWeek: 0, tracking: 0, viewingsWeek: 0, inquiriesTotal: 0, viewingsTotal: 0 };
}

/** 一筆紀錄在週報上要用哪個時間排序／顯示：客戶類用帶看時間（沒帶看就用詢問時間），其餘用發生時間。 */
export function recordTimestamp(record: CustomerRecord): string | null {
  if (record.kind === "customer") return record.viewedAt ?? record.inquiredAt;
  return record.occurredAt;
}

/**
 * 這筆紀錄可不可以在屋主端「逐筆顯示」。
 *
 * 詢問／追蹤中／結束追蹤是銷售過程的內部狀態：只反映在統計數字裡，不單獨列給屋主看。
 * 「詢問」列出來沒有資訊量、「結束追蹤」對屋主是負面訊息、「追蹤中」是狀態不是事件，
 * 掛一個日期在旁邊只會讓人困惑。真正發生的事（已安排帶看、實際帶看、同業回饋、
 * 推廣紀錄、其他）才列出來。
 *
 * 這是第一層過濾；每筆紀錄的「顯示給屋主」開關是第二層，兩層都通過才會進週報。
 */
export function isListableForOwner(record: CustomerRecord): boolean {
  if (record.kind !== "customer") return true;
  return record.status === "appointed" || record.status === "viewed";
}

/**
 * 屋主端看到的標籤，跟後台的內部用語分開維護。
 * 例如後台叫「已約帶看」（業務視角），對屋主講「已安排帶看」比較自然。
 */
export function ownerFacingLabel(record: CustomerRecord): string {
  if (record.kind === "customer" && record.status === "appointed") return "已安排帶看";
  return recordLabel(record);
}

export function recordLabel(record: CustomerRecord): string {
  if (record.kind !== "customer") {
    return CUSTOMER_RECORD_KINDS.find((k) => k.key === record.kind)?.label ?? "紀錄";
  }
  return CUSTOMER_RECORD_STATUSES.find((s) => s.key === record.status)?.label ?? "客戶";
}

function within(value: string | null, startIso: string, endIso: string) {
  if (!value) return false;
  return value >= startIso && value <= endIso;
}

/**
 * 算出這個報告週期的統計數字，並挑出「可以放進週報給屋主看」的紀錄。
 *
 * 給「新增／編輯週報」頁在載入當下呼叫；實際存進報告的是使用者送出表單當下勾選的結果，
 * 不是這裡算出來就直接存檔。跟競品追蹤 buildMarketSnapshot() 同一種模式。
 */
export async function buildCustomerSnapshot(
  sellerId: string,
  periodStart: string,
  periodEnd: string,
  baseline: { inquiries: number; viewings: number }
): Promise<{ stats: CustomerStats; records: CustomerRecord[] }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { stats: emptyCustomerStats(), records: [] };

  const records = await listCustomerRecords(sellerId);
  const startIso = new Date(`${periodStart}T00:00:00.000Z`).toISOString();
  const endIso = new Date(`${periodEnd}T23:59:59.999Z`).toISOString();

  const customers = records.filter((r) => r.kind === "customer");

  const stats: CustomerStats = {
    inquiriesWeek: customers.filter((r) => within(r.inquiredAt, startIso, endIso)).length,
    // 「目前」仍在追蹤，不看週期——這是狀態，不是本週發生的事件。
    tracking: customers.filter((r) => TRACKING_STATUSES.includes(r.status)).length,
    viewingsWeek: customers.filter((r) => within(r.viewedAt, startIso, endIso)).length,
    inquiriesTotal:
      baseline.inquiries + customers.filter((r) => r.inquiredAt !== null && r.inquiredAt <= endIso).length,
    viewingsTotal:
      baseline.viewings + customers.filter((r) => r.viewedAt !== null && r.viewedAt <= endIso).length
  };

  return { stats, records };
}

/** 這筆紀錄「落在這個報告週期內」嗎？用來決定週報預設勾選哪幾筆。 */
export function isRecordInPeriod(record: CustomerRecord, periodStart: string, periodEnd: string) {
  const startIso = new Date(`${periodStart}T00:00:00.000Z`).toISOString();
  const endIso = new Date(`${periodEnd}T23:59:59.999Z`).toISOString();
  return within(recordTimestamp(record), startIso, endIso);
}

/** 把選定的紀錄轉成要存進週報的內容——這裡就是屋主隱私的最後一道關卡。 */
export function toSnapshotItem(record: CustomerRecord): CustomerSnapshotItem {
  return {
    recordId: record.id,
    kind: record.kind,
    label: ownerFacingLabel(record),
    occurredAt: recordTimestamp(record) ?? record.createdAt,
    feedback: record.feedback,
    photos: record.photos
    // 註：customerAlias / internalNote 刻意不複製，屋主端沒有任何管道讀到。
  };
}
