import { NextResponse } from "next/server";
import {
  createSalesRecord,
  kindHasGroups,
  listSalesRecords,
  type SalesRecordInput,
  type SalesRecordKind
} from "@/lib/seller-sales-store";
import { isImplausibleYear, IMPLAUSIBLE_YEAR_MESSAGE } from "@/lib/date-guard";

const KINDS: SalesRecordKind[] = ["viewing", "appointment", "inquiry", "peer_feedback", "promotion", "other"];

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const records = await listSalesRecords(id);
  return NextResponse.json({ ok: true, records });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const kind: SalesRecordKind = KINDS.includes(body.kind) ? body.kind : "viewing";
  const occurredOn = String(body.occurredOn || "").trim();

  if (!occurredOn) {
    return NextResponse.json({ ok: false, error: "請填寫日期。" }, { status: 400 });
  }
  // 民國年打成 115 會被存成西元 115 年，這個坑踩過兩次，前後端都擋。
  if (isImplausibleYear(occurredOn)) {
    return NextResponse.json({ ok: false, error: IMPLAUSIBLE_YEAR_MESSAGE }, { status: 400 });
  }

  // 組數只有帶看／詢問類才有意義，其他類型一律存 null，避免畫面出現「同業回饋 1 組」這種怪東西。
  let groupCount: number | null = null;
  if (kindHasGroups(kind)) {
    const parsed = Number(body.groupCount);
    groupCount = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  }

  const input: SalesRecordInput = {
    kind,
    occurredOn,
    groupCount,
    summary: String(body.summary || ""),
    internalNote: String(body.internalNote || ""),
    photos: Array.isArray(body.photos) ? body.photos : [],
    visibleToOwner: body.visibleToOwner !== false
  };

  const record = await createSalesRecord(id, input);
  return NextResponse.json({ ok: true, record });
}
