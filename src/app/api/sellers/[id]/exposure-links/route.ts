import { NextResponse } from "next/server";
import {
  ExposureLinkValidationError,
  listExposureLinks,
  upsertExposureLink
} from "@/lib/seller-exposure-store";
import { PRIMARY_EXPOSURE_PLATFORMS, type PrimaryExposurePlatform } from "@/lib/seller-report-store";
import { isImplausibleYear, IMPLAUSIBLE_YEAR_MESSAGE } from "@/lib/date-guard";

const PLATFORMS = PRIMARY_EXPOSURE_PLATFORMS.map((p) => p.key);

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const links = await listExposureLinks(id);
  return NextResponse.json({ ok: true, links });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const platform = body.platform as PrimaryExposurePlatform;
  if (!PLATFORMS.includes(platform)) {
    return NextResponse.json({ ok: false, error: "不支援的曝光平台。" }, { status: 400 });
  }

  const startedAt = String(body.startedAt || "").trim();
  if (!startedAt) {
    return NextResponse.json({ ok: false, error: "開始刊登日期為必填。" }, { status: 400 });
  }
  if (isImplausibleYear(startedAt)) {
    return NextResponse.json({ ok: false, error: IMPLAUSIBLE_YEAR_MESSAGE }, { status: 400 });
  }

  try {
    const link = await upsertExposureLink(id, {
      platform,
      listingUrl: typeof body.listingUrl === "string" ? body.listingUrl : null,
      startedAt,
      manualNote: typeof body.manualNote === "string" ? body.manualNote : ""
    });
    return NextResponse.json({ ok: true, link });
  } catch (caught) {
    if (caught instanceof ExposureLinkValidationError) {
      return NextResponse.json({ ok: false, error: caught.message }, { status: 400 });
    }
    throw caught;
  }
}
