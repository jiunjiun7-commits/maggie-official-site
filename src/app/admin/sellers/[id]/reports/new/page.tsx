import { notFound } from "next/navigation";
import Topbar from "@/app/_components/Topbar";
import { getSeller } from "@/lib/seller-store";
import ReportForm from "../ReportForm";
import "../../../../login/login.css";
import "../../../sellers.css";

export const dynamic = "force-dynamic";

export default async function NewSellerReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seller = await getSeller(id);
  if (!seller) notFound();

  return (
    <div className="admin-page">
      <Topbar admin />
      <main className="admin-shell">
        <div className="admin-heading">
          <div>
            <h1>{seller.communityName}｜新增週報</h1>
            <p>
              <a href={`/admin/sellers/${seller.id}`} style={{ color: "var(--gold-400)" }}>← 回案件管理</a>
            </p>
          </div>
        </div>
        <ReportForm sellerId={seller.id} />
      </main>
    </div>
  );
}
