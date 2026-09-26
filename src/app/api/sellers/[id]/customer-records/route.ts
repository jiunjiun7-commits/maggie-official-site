import { NextResponse } from "next/server";
import {
  createCustomerRecord,
  listCustomerRecords,
  type CustomerRecordInput,
  type CustomerRecordKind,
  type CustomerRecordStatus
} from "@/lib/seller-customer-store";
import { isImplausibleYear, IMPLAUSIBLE_YEAR_MESSAGE } from "@/lib/date-guard";

const KINDS: CustomerRecordKind[] = ["customer", "peer_feedback", "promotion", "other"];
const STATUSES: CustomerRecordStatus[] = ["inquiry", "tracking", "appointed", "viewed", "closed"];

/**
 * 前端送的是 date 字串（YYYY-MM-DD），空字串代表沒填。
 *
 * 只有日期沒有時間時固定存當天「中午 UTC」，不是午夜——午夜存下去，
 * 換算到別的時區顯示時有機會掉到前一天，中午留了 12 小時的緩衝，怎麼換算都還是同一天。
 * 仍然接受帶時間的字串（舊資料或之後有需要時），照原樣解析。
 */
function parseTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
  const date = new Date(dateOnly ? `${value.trim()}T12:00:00.000Z` : value);
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

  // 日期防呆：民國年打成 115 會變成西元 115 年。這個坑踩過兩次，前後端都擋。
  for (const [label, value] of [["詢問日期", inquiredAt], ["帶看日期", viewedAt], ["發生日期", occurredAt]] as const) {
    if (value && isImplausibleYear(value.slice(0, 10))) {
      return NextResponse.json({ ok: false, error: `${label}：${IMPLAUSIBLE_YEAR_MESSAGE}` }, { status: 400 });
    }
  }

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
