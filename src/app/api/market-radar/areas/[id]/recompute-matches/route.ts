import { NextResponse } from "next/server";
import { recomputeAreaMatches } from "@/lib/market-radar-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 只重算單一區域的官方交易命中結果，不影響其他區域，不做 LINE/Cron。 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const result = await recomputeAreaMatches(id);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "重新計算失敗" }, { status: 500 });
  }
}
