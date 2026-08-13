import { NextResponse } from "next/server";
import { getArea, listAreaRules, updateArea } from "@/lib/market-radar-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const area = await getArea(id);
  if (!area) return NextResponse.json({ ok: false, error: "找不到這個區域。" }, { status: 404 });
  const rules = await listAreaRules(id);
  return NextResponse.json({ ok: true, area, rules });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const input: Record<string, unknown> = {};
  if (typeof body.name === "string") input.name = body.name.trim();
  if (typeof body.district === "string") input.district = body.district.trim();
  if (typeof body.note === "string") input.note = body.note;
  if (typeof body.isActive === "boolean") input.isActive = body.isActive;
  if (typeof body.sortOrder === "number") input.sortOrder = body.sortOrder;

  if (input.name === "") {
    return NextResponse.json({ ok: false, error: "區域名稱不能是空的。" }, { status: 400 });
  }

  const area = await updateArea(id, input);
  if (!area) return NextResponse.json({ ok: false, error: "找不到這個區域。" }, { status: 404 });
  return NextResponse.json({ ok: true, area });
}
