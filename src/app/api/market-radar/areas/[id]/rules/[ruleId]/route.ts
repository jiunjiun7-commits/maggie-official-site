import { NextResponse } from "next/server";
import { deleteAreaRule, updateAreaRuleBbox, updateAreaRulePolygon } from "@/lib/market-radar-store";
import { parseBbox, parsePolygon } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 目前只用來讓既有 bbox／polygon 規則重新編輯範圍，不開放改其他欄位或 ruleType。 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string; ruleId: string }> }) {
  const { ruleId } = await context.params;
  const body = await request.json().catch(() => ({}));

  if (body.polygon !== undefined) {
    const polygon = parsePolygon(body.polygon);
    if (!polygon) {
      return NextResponse.json({ ok: false, error: "多邊形至少需要 3 個頂點，請重新繪製。" }, { status: 400 });
    }
    const rule = await updateAreaRulePolygon(ruleId, polygon);
    if (!rule) return NextResponse.json({ ok: false, error: "找不到這條規則。" }, { status: 404 });
    return NextResponse.json({ ok: true, rule });
  }

  if (body.bbox !== undefined) {
    const bbox = parseBbox(body.bbox);
    if (!bbox) {
      return NextResponse.json({ ok: false, error: "框選範圍不完整或無效，請重新框選。" }, { status: 400 });
    }
    const rule = await updateAreaRuleBbox(ruleId, bbox);
    if (!rule) return NextResponse.json({ ok: false, error: "找不到這條規則。" }, { status: 404 });
    return NextResponse.json({ ok: true, rule });
  }

  return NextResponse.json({ ok: false, error: "缺少 bbox 或 polygon。" }, { status: 400 });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string; ruleId: string }> }) {
  const { ruleId } = await context.params;
  await deleteAreaRule(ruleId);
  return NextResponse.json({ ok: true });
}
