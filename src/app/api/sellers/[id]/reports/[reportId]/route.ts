import { NextResponse } from "next/server";
import {
  getSellerReport,
  ReportPeriodConflictError,
  updateSellerReport,
  type SellerReportInput
} from "@/lib/seller-report-store";
import { isImplausibleYear, IMPLAUSIBLE_YEAR_MESSAGE } from "@/lib/date-guard";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; reportId: string }> }
) {
  const { id, reportId } = await context.params;
  const report = await getSellerReport(id, reportId);
  if (!report) return NextResponse.json({ ok: false, error: "找不到這筆週報。" }, { status: 404 });
  return NextResponse.json({ ok: true, report });
}

function parsePartialInput(body: Record<string, unknown>): Partial<SellerReportInput> {
  const input: Partial<SellerReportInput> = {};
  const num = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  const numOrNull = (value: unknown) => {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  if (typeof body.reportDate === "string") input.reportDate = body.reportDate;
  if (typeof body.periodStart === "string") input.periodStart = body.periodStart;
  if (typeof body.periodEnd === "string") input.periodEnd = body.periodEnd;
  if (body.exposure !== undefined) input.exposure = body.exposure as SellerReportInput["exposure"];
  if (body.inquiriesWeek !== undefined) input.inquiriesWeek = num(body.inquiriesWeek);
  if (body.inquiriesTotal !== undefined) input.inquiriesTotal = num(body.inquiriesTotal);
  if (body.viewingsWeek !== undefined) input.viewingsWeek = num(body.viewingsWeek);
  if (body.viewingsTotal !== undefined) input.viewingsTotal = num(body.viewingsTotal);
  if (body.viewingsPending !== undefined) input.viewingsPending = num(body.viewingsPending);
  if (typeof body.feedbackText === "string") input.feedbackText = body.feedbackText;
  if (body.marketListingsCount !== undefined) input.marketListingsCount = numOrNull(body.marketListingsCount);
  if (body.marketNewListings !== undefined) input.marketNewListings = numOrNull(body.marketNewListings);
  if (body.marketPriceCuts !== undefined) input.marketPriceCuts = numOrNull(body.marketPriceCuts);
  if (body.marketSoldCount !== undefined) input.marketSoldCount = numOrNull(body.marketSoldCount);
  if (typeof body.marketObservationText === "string") input.marketObservationText = body.marketObservationText;
  if (Array.isArray(body.competitors)) input.competitors = body.competitors as SellerReportInput["competitors"];
  if (typeof body.maggieNotes === "string") input.maggieNotes = body.maggieNotes;
  if (body.nextWeekStrategy !== undefined) {
    input.nextWeekStrategy = body.nextWeekStrategy as SellerReportInput["nextWeekStrategy"];
  }
  if (typeof body.weeklyGoal === "string") input.weeklyGoal = body.weeklyGoal;
  if (typeof body.ownerActionNeeded === "string") input.ownerActionNeeded = body.ownerActionNeeded;
  if (Array.isArray(body.promotionPhotos)) {
    input.promotionPhotos = body.promotionPhotos as SellerReportInput["promotionPhotos"];
  }
  if (body.marketCompetitorSnapshot !== undefined) {
    input.marketCompetitorSnapshot = body.marketCompetitorSnapshot as SellerReportInput["marketCompetitorSnapshot"];
  }

  return input;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; reportId: string }> }
) {
  const { id, reportId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const input = parsePartialInput(body);

  if (
    (input.reportDate && isImplausibleYear(input.reportDate)) ||
    (input.periodStart && isImplausibleYear(input.periodStart)) ||
    (input.periodEnd && isImplausibleYear(input.periodEnd))
  ) {
    return NextResponse.json({ ok: false, error: IMPLAUSIBLE_YEAR_MESSAGE }, { status: 400 });
  }

  try {
    const report = await updateSellerReport(id, reportId, input);
    if (!report) return NextResponse.json({ ok: false, error: "找不到這筆週報。" }, { status: 404 });
    return NextResponse.json({ ok: true, report });
  } catch (caught) {
    if (caught instanceof ReportPeriodConflictError) {
      return NextResponse.json({ ok: false, error: caught.message }, { status: 409 });
    }
    throw caught;
  }
}
