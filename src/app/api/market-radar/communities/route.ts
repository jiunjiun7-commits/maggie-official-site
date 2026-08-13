import { NextResponse } from "next/server";
import { createCommunity, listCommunities } from "@/lib/market-radar-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const communities = await listCommunities();
  return NextResponse.json({ ok: true, communities });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const name = String(body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "社區名稱為必填。" }, { status: 400 });
  }

  const community = await createCommunity({
    name,
    areaId: body.areaId ? String(body.areaId) : null,
    district: String(body.district || "").trim(),
    addressKeyword: String(body.addressKeyword || "").trim(),
    lat: typeof body.lat === "number" ? body.lat : null,
    lng: typeof body.lng === "number" ? body.lng : null,
    note: String(body.note || "")
  });

  return NextResponse.json({ ok: true, community });
}
