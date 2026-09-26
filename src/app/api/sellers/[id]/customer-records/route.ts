import { NextResponse } from "next/server";
import {
  createCustomerRecord,
  listCustomerRecords,
  type CustomerRecordInput,
  type CustomerRecordKind,
  type CustomerRecordStatus
} from "@/lib/seller-customer-store";

const KINDS: CustomerRecordKind[] = ["customer", "peer_feedback", "promotion", "other"];
const STATUSES: CustomerRecordStatus[] = ["inquiry", "tracking", "appointed", "viewed", "closed"];

/** 前端送的是 datetime-local 字串（沒有時區），空字串代表沒填。 */
function parseTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const records = await listCustomerRecords(id);
  return NextResponse.json({ ok: true, records });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const kind: CustomerRecordKind = KINDS.includes(body.kind) ? body.kind : "customer";
  const status: CustomerRecordStatus =
    kind === "customer" && STATUSES.includes(body.status) ? body.status : "inquiry";

  const inquiredAt = parseTimestamp(body.inquiredAt);
  const viewedAt = parseTimestamp(body.viewedAt);
  const occurredAt = parseTimestamp(body.occurredAt);

  // 每一種紀錄至少要有一個時間，否則週報無從判斷它屬於哪一週。
  if (kind === "customer" && !inquiredAt && !viewedAt) {
    return NextResponse.json({ ok: false, error: "請至少填寫詢問時間或帶看時間。" }, { status: 400 });
  }
  if (kind !== "customer" && !occurredAt) {
    return NextResponse.json({ ok: false, error: "請填寫發生時間。" }, { status: 400 });
  }
  if (status === "viewed" && !viewedAt) {
    return NextResponse.json({ ok: false, error: "狀態是「實際帶看」時，必須填寫帶看時間。" }, { status: 400 });
  }

  const input: CustomerRecordInput = {
    kind,
    status,
    inquiredAt,
    viewedAt,
    occurredAt,
    customerAlias: String(body.customerAlias || ""),
    feedback: String(body.feedback || ""),
    internalNote: String(body.internalNote || ""),
    photos: Array.isArray(body.photos) ? body.photos : [],
    visibleToOwner: body.visibleToOwner !== false
  };

  const record = await createCustomerRecord(id, input);
  return NextResponse.json({ ok: true, record });
}
