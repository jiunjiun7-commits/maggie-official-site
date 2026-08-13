import { NextResponse } from "next/server";
import { issueSellerToken, revokeSellerTokens } from "@/lib/seller-portal";

/** 產生新連結，會自動撤銷這個案件目前有效的舊連結。明碼只在這次回應裡出現一次。 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const token = await issueSellerToken(id);
  return NextResponse.json({ ok: true, token, portalPath: `/portal/${token}` });
}

/** 只撤銷，不重新產生——用在「連結外流，先關掉」的情境。 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await revokeSellerTokens(id);
  return NextResponse.json({ ok: true });
}
