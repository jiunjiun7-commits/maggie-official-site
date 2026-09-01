import { notFound } from "next/navigation";
import Sidebar from "@/app/admin/_components/Sidebar";
import { getSeller } from "@/lib/seller-store";
import { getSellerReport } from "@/lib/seller-report-store";
import { listExposureLinks } from "@/lib/seller-exposure-store";
import { buildMarketSnapshot } from "@/lib/seller-market-store";
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
  const [seller, report, exposureLinks] = await Promise.all([
    getSeller(id),
    getSellerReport(id, reportId),
    listExposureLinks(id)
  ]);
  if (!seller || !report) notFound();

  // 編輯既有週報時，用這份報告「真正的週期」重新查一次目前的競品清單與統計數字——
  // 統計數字本身還是這次算出來的（不是凍結值），但預設勾選會把當初存進快照裡的那些也一併勾上，
  // 不會因為重算而讓她原本手動選的項目掉勾（見 ReportForm.tsx 的 selectedCompetitorIds 初始化邏輯）。
  const { stats: marketStats, competitors: marketCompetitors } = await buildMarketSnapshot(
    id,
    report.periodStart,
    report.periodEnd
  );

  return (
    <div className="admin-page">
      <Sidebar />
      <main className="admin-shell">
        <div className="admin-heading">
          <div>
            <h1>{seller.communityName}｜編輯週報</h1>
            <p>
              <a href={`/admin/sellers/${seller.id}`} style={{ color: "var(--gold-400)" }}>← 回案件管理</a>
            </p>
          </div>
        </div>
        <ReportForm
          exposureLinks={exposureLinks}
          initialReport={report}
          marketCompetitors={marketCompetitors}
          marketStats={marketStats}
          sellerId={seller.id}
        />
      </main>
    </div>
  );
}
