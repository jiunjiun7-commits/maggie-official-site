import { NextResponse } from "next/server";
import {
  createSellerReport,
  listSellerReports,
  ReportPeriodConflictError,
  type SellerReportInput
} from "@/lib/seller-report-store";
import { isImplausibleYear, IMPLAUSIBLE_YEAR_MESSAGE } from "@/lib/date-guard";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const reports = await listSellerReports(id);
  return NextResponse.json({ ok: true, reports });
}

function parseInput(body: Record<string, unknown>): SellerReportInput | null {
  const reportDate = String(body.reportDate || "").trim();
  const periodStart = String(body.periodStart || "").trim();
  const periodEnd = String(body.periodEnd || "").trim();
  if (!reportDate || !periodStart || !periodEnd) return null;

  const num = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  const numOrNull = (value: unknown) => {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const salesSnapshot = (body.salesSnapshot as SellerReportInput["salesSnapshot"]) || {
    stats: { inquiryGroups: 0, viewingGroups: 0, viewingGroupsTotal: 0 },
    items: []
  };

  // V2 之後這五個舊欄位不再由人工輸入，改由客戶紀錄的統計推導。
  // 在伺服器端推導而不是靠前端送上來，任何呼叫端（表單、腳本、之後的自動化）
  // 建立的週報都會保持一致，不會出現快照有數字、舊欄位卻是 0 的情況。
  const st = salesSnapshot.stats;
  const derived = {
    inquiriesWeek: body.inquiriesWeek !== undefined ? num(body.inquiriesWeek) : st.inquiryGroups,
    inquiriesTotal: body.inquiriesTotal !== undefined ? num(body.inquiriesTotal) : 0,
    viewingsWeek: body.viewingsWeek !== undefined ? num(body.viewingsWeek) : st.viewingGroups,
    viewingsTotal: body.viewingsTotal !== undefined ? num(body.viewingsTotal) : st.viewingGroupsTotal,
    // 「待安排帶看」這個舊欄位在 V2 沒有對應概念（追蹤中已確認不做），保留欄位但不再填數字。
    viewingsPending: body.viewingsPending !== undefined ? num(body.viewingsPending) : 0
  };

  return {
    reportDate,
    periodStart,
    periodEnd,
    exposure: (body.exposure as SellerReportInput["exposure"]) || {},
    inquiriesWeek: derived.inquiriesWeek,
    inquiriesTotal: derived.inquiriesTotal,
    viewingsWeek: derived.viewingsWeek,
    viewingsTotal: derived.viewingsTotal,
    viewingsPending: derived.viewingsPending,
    feedbackText: String(body.feedbackText || ""),
    marketListingsCount: numOrNull(body.marketListingsCount),
    marketNewListings: numOrNull(body.marketNewListings),
    marketPriceCuts: numOrNull(body.marketPriceCuts),
    marketSoldCount: numOrNull(body.marketSoldCount),
    marketObservationText: String(body.marketObservationText || ""),
    competitors: Array.isArray(body.competitors) ? (body.competitors as SellerReportInput["competitors"]) : [],
    maggieNotes: String(body.maggieNotes || ""),
    nextWeekStrategy: (body.nextWeekStrategy as SellerReportInput["nextWeekStrategy"]) || { checklist: [], note: "" },
    weeklyGoal: String(body.weeklyGoal || ""),
    ownerActionNeeded: String(body.ownerActionNeeded || ""),
    promotionPhotos: Array.isArray(body.promotionPhotos)
      ? (body.promotionPhotos as SellerReportInput["promotionPhotos"])
      : [],
    marketCompetitorSnapshot: (body.marketCompetitorSnapshot as SellerReportInput["marketCompetitorSnapshot"]) || {
      stats: { available: 0, newThisWeek: 0, priceCutThisWeek: 0, soldThisWeek: 0 },
      items: []
    },
    salesSnapshot
  };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const input = parseInput(body);
  if (!input) {
    return NextResponse.json({ ok: false, error: "回報日期與報告週期為必填。" }, { status: 400 });
  }
  if (isImplausibleYear(input.reportDate) || isImplausibleYear(input.periodStart) || isImplausibleYear(input.periodEnd)) {
    return NextResponse.json({ ok: false, error: IMPLAUSIBLE_YEAR_MESSAGE }, { status: 400 });
  }

  try {
    const report = await createSellerReport(id, input);
    return NextResponse.json({ ok: true, report });
  } catch (caught) {
    if (caught instanceof ReportPeriodConflictError) {
      return NextResponse.json({ ok: false, error: caught.message }, { status: 409 });
    }
    throw caught;
  }
}
