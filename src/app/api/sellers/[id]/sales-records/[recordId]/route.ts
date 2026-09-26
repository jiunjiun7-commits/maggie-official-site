import { NextResponse } from "next/server";
import {
  deleteSalesRecord,
  updateSalesRecord,
  type SalesRecordInput,
  type SalesRecordKind
} from "@/lib/seller-sales-store";
import { isImplausibleYear, IMPLAUSIBLE_YEAR_MESSAGE } from "@/lib/date-guard";

const KINDS: SalesRecordKind[] = ["viewing", "appointment", "inquiry", "peer_feedback", "promotion", "other"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; recordId: string }> }
) {
  const { id, recordId } = await context.params;
  const body = await request.json().catch(() => ({}));

  const input: Partial<SalesRecordInput> = {};

  if (typeof body.kind === "string") {
    if (!KINDS.includes(body.kind as SalesRecordKind)) {
      return NextResponse.json({ ok: false, error: "不支援的紀錄類型。" }, { status: 400 });
    }
    input.kind = body.kind as SalesRecordKind;
  }

  if (typeof body.occurredOn === "string") {
    const occurredOn = body.occurredOn.trim();
    if (!occurredOn) return NextResponse.json({ ok: false, error: "請填寫日期。" }, { status: 400 });
    if (isImplausibleYear(occurredOn)) {
      return NextResponse.json({ ok: false, error: IMPLAUSIBLE_YEAR_MESSAGE }, { status: 400 });
    }
    input.occurredOn = occurredOn;
  }

  if (body.groupCount !== undefined) {
    const parsed = Number(body.groupCount);
    input.groupCount = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
  }

  if (typeof body.summary === "string") input.summary = body.summary;
  if (typeof body.internalNote === "string") input.internalNote = body.internalNote;
  if (Array.isArray(body.photos)) input.photos = body.photos;
  if (typeof body.visibleToOwner === "boolean") input.visibleToOwner = body.visibleToOwner;

  const record = await updateSalesRecord(id, recordId, input);
  if (!record) return NextResponse.json({ ok: false, error: "找不到這筆紀錄。" }, { status: 404 });
  return NextResponse.json({ ok: true, record });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; recordId: string }> }
) {
  const { id, recordId } = await context.params;
  await deleteSalesRecord(id, recordId);
  return NextResponse.json({ ok: true });
}
