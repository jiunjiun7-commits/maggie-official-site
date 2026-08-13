import { NextResponse } from "next/server";
import { deleteCommunity, updateCommunity } from "@/lib/market-radar-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const input: Record<string, unknown> = {};
  if (typeof body.name === "string") input.name = body.name.trim();
  if ("areaId" in body) input.areaId = body.areaId ? String(body.areaId) : null;
  if (typeof body.district === "string") input.district = body.district.trim();
  if (typeof body.addressKeyword === "string") input.addressKeyword = body.addressKeyword.trim();
  if (typeof body.lat === "number") input.lat = body.lat;
  if (typeof body.lng === "number") input.lng = body.lng;
  if (typeof body.note === "string") input.note = body.note;

  if (input.name === "") {
    return NextResponse.json({ ok: false, error: "社區名稱不能是空的。" }, { status: 400 });
  }

  const community = await updateCommunity(id, input);
  if (!community) return NextResponse.json({ ok: false, error: "找不到這個社區。" }, { status: 404 });
  return NextResponse.json({ ok: true, community });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await deleteCommunity(id);
  return NextResponse.json({ ok: true });
}
