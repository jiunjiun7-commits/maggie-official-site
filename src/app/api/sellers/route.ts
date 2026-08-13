import { NextResponse } from "next/server";
import { createSeller, listSellers, type SellerStatus } from "@/lib/seller-store";

const STATUS: SellerStatus[] = ["active", "sold", "ended"];

export async function GET() {
  const sellers = await listSellers();
  return NextResponse.json({ ok: true, sellers });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const communityName = String(body.communityName || "").trim();
  const ownerName = String(body.ownerName || "").trim();
  const engagementStart = String(body.engagementStart || "").trim();
  const engagementEnd = String(body.engagementEnd || "").trim();
  const status = STATUS.includes(body.status) ? (body.status as SellerStatus) : "active";

  if (!communityName || !ownerName || !engagementStart || !engagementEnd) {
    return NextResponse.json(
      { ok: false, error: "社區/案名、屋主姓名、委託起訖日為必填。" },
      { status: 400 }
    );
  }

  const seller = await createSeller({
    communityName,
    district: String(body.district || ""),
    listingTitle: String(body.listingTitle || ""),
    ownerName,
    engagementStart,
    engagementEnd,
    askingPrice: String(body.askingPrice || ""),
    address: String(body.address || ""),
    internalNote: String(body.internalNote || ""),
    status
  });

  return NextResponse.json({ ok: true, seller });
}
