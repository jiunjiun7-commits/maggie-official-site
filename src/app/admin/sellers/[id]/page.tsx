import { notFound } from "next/navigation";
import Sidebar from "@/app/admin/_components/Sidebar";
import { getSeller } from "@/lib/seller-store";
import { listSellerReports } from "@/lib/seller-report-store";
import { hasActiveSellerToken } from "@/lib/seller-portal";
import { listExposureLinks } from "@/lib/seller-exposure-store";
import SellerDetailBoard from "./SellerDetailBoard";
import "../../login/login.css";
import "../sellers.css";

export const dynamic = "force-dynamic";

export default async function SellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seller = await getSeller(id);
  if (!seller) notFound();

  const [reports, hasToken, exposureLinks] = await Promise.all([
    listSellerReports(id),
    hasActiveSellerToken(id),
    listExposureLinks(id)
  ]);

  return (
    <div className="admin-page">
      <Sidebar />
      <SellerDetailBoard
        initialExposureLinks={exposureLinks}
        initialHasToken={hasToken}
        initialReports={reports}
        initialSeller={seller}
      />
    </div>
  );
}
