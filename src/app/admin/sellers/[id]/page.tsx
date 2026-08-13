import { notFound } from "next/navigation";
import Topbar from "@/app/_components/Topbar";
import { getSeller } from "@/lib/seller-store";
import { listSellerReports } from "@/lib/seller-report-store";
import { hasActiveSellerToken } from "@/lib/seller-portal";
import SellerDetailBoard from "./SellerDetailBoard";
import "../../login/login.css";
import "../sellers.css";

export const dynamic = "force-dynamic";

export default async function SellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seller = await getSeller(id);
  if (!seller) notFound();

  const [reports, hasToken] = await Promise.all([listSellerReports(id), hasActiveSellerToken(id)]);

  return (
    <div className="admin-page">
      <Topbar admin />
      <form action="/api/auth/logout" method="post" style={{ padding: "12px 24px 0", textAlign: "right" }}>
        <button className="admin-logout" type="submit">登出</button>
      </form>
      <SellerDetailBoard initialSeller={seller} initialReports={reports} initialHasToken={hasToken} />
    </div>
  );
}
