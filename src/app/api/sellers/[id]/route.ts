import { NextResponse } from "next/server";
import { getSeller, updateSeller, type SellerStatus } from "@/lib/seller-store";
import { isImplausibleYear, IMPLAUSIBLE_YEAR_MESSAGE } from "@/lib/date-guard";

const STATUS: SellerStatus[] = ["active", "sold", "ended"];

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const seller = await getSeller(id);
  if (!seller) return NextResponse.json({ ok: false, error: "找不到這個案件。" }, { status: 404 });
  return NextResponse.json({ ok: true, seller });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const input: Record<string, unknown> = {};
  if (typeof body.communityName === "string") input.communityName = body.communityName.trim();
  if (typeof body.district === "string") input.district = body.district.trim();
  if (typeof body.listingTitle === "string") input.listingTitle = body.listingTitle.trim();
  if (typeof body.ownerName === "string") input.ownerName = body.ownerName.trim();
  if (typeof body.engagementStart === "string") {
    if (isImplausibleYear(body.engagementStart)) {
      return NextResponse.json({ ok: false, error: IMPLAUSIBLE_YEAR_MESSAGE }, { status: 400 });
    }
    input.engagementStart = body.engagementStart;
  }
  if (typeof body.engagementEnd === "string") {
    if (isImplausibleYear(body.engagementEnd)) {
      return NextResponse.json({ ok: false, error: IMPLAUSIBLE_YEAR_MESSAGE }, { status: 400 });
    }
    input.engagementEnd = body.engagementEnd;
  }
  if (typeof body.askingPrice === "string") input.askingPrice = body.askingPrice;
  if (typeof body.address === "string") input.address = body.address;
  if (typeof body.internalNote === "string") input.internalNote = body.internalNote;
  if (typeof body.status === "string") {
    if (!STATUS.includes(body.status as SellerStatus)) {
      return NextResponse.json({ ok: false, error: "不支援的案件狀態。" }, { status: 400 });
    }
    input.status = body.status;
  }

  const seller = await updateSeller(id, input);
  if (!seller) return NextResponse.json({ ok: false, error: "找不到這個案件。" }, { status: 404 });
  return NextResponse.json({ ok: true, seller });
}
