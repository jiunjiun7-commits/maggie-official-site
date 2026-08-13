import { NextResponse } from "next/server";
import { createArea, listAreas } from "@/lib/market-radar-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const areas = await listAreas();
  return NextResponse.json({ ok: true, areas });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const name = String(body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "區域名稱為必填。" }, { status: 400 });
  }

  const area = await createArea({
    name,
    district: String(body.district || "").trim(),
    note: String(body.note || "")
  });

  return NextResponse.json({ ok: true, area });
}
