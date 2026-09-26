import { NextResponse } from "next/server";
import {
  deleteCustomerRecord,
  updateCustomerRecord,
  type CustomerRecordInput,
  type CustomerRecordKind,
  type CustomerRecordStatus
} from "@/lib/seller-customer-store";

const KINDS: CustomerRecordKind[] = ["customer", "peer_feedback", "promotion", "other"];
const STATUSES: CustomerRecordStatus[] = ["inquiry", "tracking", "appointed", "viewed", "closed"];

function parseTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; recordId: string }> }
) {
  const { id, recordId } = await context.params;
  const body = await request.json().catch(() => ({}));

  const input: Partial<CustomerRecordInput> = {};

  if (typeof body.kind === "string") {
    if (!KINDS.includes(body.kind as CustomerRecordKind)) {
      return NextResponse.json({ ok: false, error: "不支援的紀錄類型。" }, { status: 400 });
    }
    input.kind = body.kind as CustomerRecordKind;
  }
  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status as CustomerRecordStatus)) {
      return NextResponse.json({ ok: false, error: "不支援的客戶狀態。" }, { status: 400 });
    }
    input.status = body.status as CustomerRecordStatus;
  }

  if (body.inquiredAt !== undefined) input.inquiredAt = parseTimestamp(body.inquiredAt);
  if (body.viewedAt !== undefined) input.viewedAt = parseTimestamp(body.viewedAt);
  if (body.occurredAt !== undefined) input.occurredAt = parseTimestamp(body.occurredAt);

  // 推進到「實際帶看」一定要有帶看時間，否則週報算不出這筆屬於哪一週。
  // 有可能只送 status 沒送 viewedAt（就地改狀態），那就要看資料庫裡原本有沒有值——
  // 這裡只擋「同時把 viewedAt 清掉又設成 viewed」這種明確矛盾的情況。
  if (input.status === "viewed" && body.viewedAt !== undefined && !input.viewedAt) {
    return NextResponse.json({ ok: false, error: "狀態是「實際帶看」時，必須填寫帶看時間。" }, { status: 400 });
  }

  if (typeof body.customerAlias === "string") input.customerAlias = body.customerAlias;
  if (typeof body.feedback === "string") input.feedback = body.feedback;
  if (typeof body.internalNote === "string") input.internalNote = body.internalNote;
  if (Array.isArray(body.photos)) input.photos = body.photos;
  if (typeof body.visibleToOwner === "boolean") input.visibleToOwner = body.visibleToOwner;

  const record = await updateCustomerRecord(id, recordId, input);
  if (!record) return NextResponse.json({ ok: false, error: "找不到這筆紀錄。" }, { status: 404 });
  return NextResponse.json({ ok: true, record });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; recordId: string }> }
) {
  const { id, recordId } = await context.params;
  await deleteCustomerRecord(id, recordId);
  return NextResponse.json({ ok: true });
}
