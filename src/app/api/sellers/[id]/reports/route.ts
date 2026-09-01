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

  return {
    reportDate,
    periodStart,
    periodEnd,
    exposure: (body.exposure as SellerReportInput["exposure"]) || {},
    inquiriesWeek: num(body.inquiriesWeek),
    inquiriesTotal: num(body.inquiriesTotal),
    viewingsWeek: num(body.viewingsWeek),
    viewingsTotal: num(body.viewingsTotal),
    viewingsPending: num(body.viewingsPending),
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
    }
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
