import { NextResponse } from "next/server";
import {
  deleteMarketCompetitor,
  updateMarketCompetitor,
  type MarketCompetitorInput,
  type MarketCompetitorStatus
} from "@/lib/seller-market-store";

const STATUS: MarketCompetitorStatus[] = ["available", "price_cut", "sold", "delisted"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; competitorId: string }> }
) {
  const { id, competitorId } = await context.params;
  const body = await request.json().catch(() => ({}));

  const input: Partial<MarketCompetitorInput> = {};
  if (typeof body.platform === "string") input.platform = body.platform.trim();
  if (typeof body.listingUrl === "string") input.listingUrl = body.listingUrl.trim();
  if (typeof body.title === "string") input.title = body.title.trim();
  if (typeof body.note === "string") input.note = body.note;
  if (body.priceWan !== undefined) {
    const priceWan = body.priceWan === null || body.priceWan === "" ? null : Number(body.priceWan);
    if (priceWan !== null && !Number.isFinite(priceWan)) {
      return NextResponse.json({ ok: false, error: "開價必須是數字。" }, { status: 400 });
    }
    input.priceWan = priceWan;
  }
  if (typeof body.status === "string") {
    if (!STATUS.includes(body.status as MarketCompetitorStatus)) {
      return NextResponse.json({ ok: false, error: "不支援的競品狀態。" }, { status: 400 });
    }
    input.status = body.status as MarketCompetitorStatus;
  }

  const competitor = await updateMarketCompetitor(id, competitorId, input);
  if (!competitor) return NextResponse.json({ ok: false, error: "找不到這筆競品。" }, { status: 404 });
  return NextResponse.json({ ok: true, competitor });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; competitorId: string }> }
) {
  const { id, competitorId } = await context.params;
  await deleteMarketCompetitor(id, competitorId);
  return NextResponse.json({ ok: true });
}
