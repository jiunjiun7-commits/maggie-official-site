import { NextResponse } from "next/server";
import { deleteAreaRule } from "@/lib/market-radar-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string; ruleId: string }> }) {
  const { ruleId } = await context.params;
  await deleteAreaRule(ruleId);
  return NextResponse.json({ ok: true });
}
