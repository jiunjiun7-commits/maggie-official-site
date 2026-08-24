import { NextResponse } from "next/server";
import { createInternalDeal, listInternalDeals, type InternalDealSourceType } from "@/lib/internal-deal-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_TYPES: InternalDealSourceType[] = ["internal_announcement", "external_brand_intel", "other"];

export async function GET() {
  const deals = await listInternalDeals();
  return NextResponse.json({ ok: true, deals });
}

function toDateOrNull(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const sourceType = SOURCE_TYPES.includes(body.sourceType) ? (body.sourceType as InternalDealSourceType) : "internal_announcement";

  // 簽約日／內部公告日／情報取得日都不是必填——不同品牌/加盟體系可能拿不到完整時間資訊，
  // 缺值一律留 null，不可用其他欄位推測填入。
  const deal = await createInternalDeal({
    sourceType,
    transactionDate: toDateOrNull(body.transactionDate),
    internalAnnouncedDate: toDateOrNull(body.internalAnnouncedDate),
    infoReceivedDate: toDateOrNull(body.infoReceivedDate),
    district: String(body.district || "").trim(),
    address: String(body.address || "").trim(),
    communityNameInput: String(body.communityNameInput || "").trim(),
    mainUseInput: String(body.mainUseInput || "").trim(),
    buildingTypeInput: String(body.buildingTypeInput || "").trim(),
    buildingAreaPing: toNumberOrNull(body.buildingAreaPing),
    landAreaPing: toNumberOrNull(body.landAreaPing),
    parkingRaw: String(body.parkingRaw || "").trim(),
    totalPrice: toNumberOrNull(body.totalPrice),
    unitPrice: toNumberOrNull(body.unitPrice),
    dealBrand: body.dealBrand ? String(body.dealBrand).trim() : null,
    dealBranch: body.dealBranch ? String(body.dealBranch).trim() : null,
    infoSource: body.infoSource ? String(body.infoSource).trim() : null,
    verified: Boolean(body.verified),
    note: String(body.note || ""),
    createdBy: String(body.createdBy || "")
  });

  return NextResponse.json({ ok: true, deal });
}
