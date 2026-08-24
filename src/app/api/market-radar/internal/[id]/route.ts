import { NextResponse } from "next/server";
import { getInternalDeal, updateInternalDeal } from "@/lib/internal-deal-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const deal = await getInternalDeal(id);
  if (!deal) return NextResponse.json({ ok: false, error: "找不到這筆內部成交情報。" }, { status: 404 });
  return NextResponse.json({ ok: true, deal });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const input: Record<string, unknown> = {};
  if (typeof body.verified === "boolean") input.verified = body.verified;
  if (typeof body.note === "string") input.note = body.note;
  if (typeof body.dealBrand === "string") input.dealBrand = body.dealBrand;
  if (typeof body.dealBranch === "string") input.dealBranch = body.dealBranch;
  if (typeof body.infoSource === "string") input.infoSource = body.infoSource;

  const deal = await updateInternalDeal(id, input);
  if (!deal) return NextResponse.json({ ok: false, error: "找不到這筆內部成交情報。" }, { status: 404 });
  return NextResponse.json({ ok: true, deal });
}
