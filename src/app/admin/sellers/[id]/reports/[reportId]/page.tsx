import { notFound } from "next/navigation";
import Topbar from "@/app/_components/Topbar";
import { getSeller } from "@/lib/seller-store";
import { getSellerReport } from "@/lib/seller-report-store";
import ReportForm from "../ReportForm";
import "../../../../login/login.css";
import "../../../sellers.css";

export const dynamic = "force-dynamic";

export default async function EditSellerReportPage({
  params
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { id, reportId } = await params;
  const [seller, report] = await Promise.all([getSeller(id), getSellerReport(id, reportId)]);
  if (!seller || !report) notFound();

  return (
    <div className="admin-page">
      <Topbar admin />
      <main className="admin-shell">
        <div className="admin-heading">
          <div>
            <h1>{seller.communityName}｜編輯週報</h1>
            <p>
              <a href={`/admin/sellers/${seller.id}`} style={{ color: "var(--gold-400)" }}>← 回案件管理</a>
            </p>
          </div>
        </div>
        <ReportForm initialReport={report} sellerId={seller.id} />
      </main>
    </div>
  );
}
