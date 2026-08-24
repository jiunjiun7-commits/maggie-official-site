import { NextResponse } from "next/server";
import { addAreaRule, type AreaRuleType, type Bbox, type Polygon } from "@/lib/market-radar-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RULE_TYPES: AreaRuleType[] = ["road", "district", "section", "community", "address_keyword", "bbox", "polygon"];
const MIN_POLYGON_POINTS = 3;

export function parseBbox(value: unknown): Bbox | null {
  if (!value || typeof value !== "object") return null;
  const { north, south, east, west } = value as Record<string, unknown>;
  if ([north, south, east, west].some((v) => typeof v !== "number" || Number.isNaN(v))) return null;
  const box = { north, south, east, west } as Bbox;
  if (box.north <= box.south || box.east <= box.west) return null;
  return box;
}

export function parsePolygon(value: unknown): Polygon | null {
  if (!Array.isArray(value) || value.length < MIN_POLYGON_POINTS) return null;
  const points: Polygon = [];
  for (const p of value) {
    if (!p || typeof p !== "object") return null;
    const { lat, lng } = p as Record<string, unknown>;
    if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) return null;
    points.push({ lat, lng });
  }
  return points;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const ruleType = body.ruleType as AreaRuleType;
  if (!RULE_TYPES.includes(ruleType)) {
    return NextResponse.json({ ok: false, error: "不支援的規則類型。" }, { status: 400 });
  }

  if (ruleType === "bbox") {
    const bbox = parseBbox(body.bbox);
    if (!bbox) {
      return NextResponse.json({ ok: false, error: "框選範圍不完整或無效，請重新框選。" }, { status: 400 });
    }
    const rule = await addAreaRule({ areaId: id, ruleType, bbox });
    return NextResponse.json({ ok: true, rule });
  }

  if (ruleType === "polygon") {
    const polygon = parsePolygon(body.polygon);
    if (!polygon) {
      return NextResponse.json({ ok: false, error: `多邊形至少需要 ${MIN_POLYGON_POINTS} 個頂點，請重新繪製。` }, { status: 400 });
    }
    const rule = await addAreaRule({ areaId: id, ruleType, polygon });
    return NextResponse.json({ ok: true, rule });
  }

  const ruleValue = String(body.ruleValue || "").trim();
  if (!ruleValue) {
    return NextResponse.json({ ok: false, error: "規則內容為必填。" }, { status: 400 });
  }
  const rule = await addAreaRule({ areaId: id, ruleType, ruleValue });
  return NextResponse.json({ ok: true, rule });
}
