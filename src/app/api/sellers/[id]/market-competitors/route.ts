import { NextResponse } from "next/server";
import { createMarketCompetitor, listMarketCompetitors, type MarketCompetitorStatus } from "@/lib/seller-market-store";

const STATUS: MarketCompetitorStatus[] = ["available", "price_cut", "sold", "delisted"];

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const competitors = await listMarketCompetitors(id);
  return NextResponse.json({ ok: true, competitors });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const platform = String(body.platform || "").trim();
  const listingUrl = String(body.listingUrl || "").trim();
  const title = String(body.title || "").trim();
  if (!platform || !listingUrl || !title) {
    return NextResponse.json({ ok: false, error: "平台、物件網址、標題為必填。" }, { status: 400 });
  }

  const status = STATUS.includes(body.status) ? (body.status as MarketCompetitorStatus) : "available";
  const priceWan = body.priceWan === null || body.priceWan === undefined || body.priceWan === "" ? null : Number(body.priceWan);
  if (priceWan !== null && !Number.isFinite(priceWan)) {
    return NextResponse.json({ ok: false, error: "開價必須是數字。" }, { status: 400 });
  }

  const competitor = await createMarketCompetitor(id, {
    platform,
    listingUrl,
    title,
    priceWan,
    note: String(body.note || ""),
    status
  });

  return NextResponse.json({ ok: true, competitor });
}
