import { notFound } from "next/navigation";
import Sidebar from "@/app/admin/_components/Sidebar";
import { getSeller } from "@/lib/seller-store";
import {
  EXPOSURE_TRACKING_CAPABILITY,
  PRIMARY_EXPOSURE_PLATFORMS,
  getSellerReport,
  isUntrackedAutoSnapshot,
  type ExposureAutoSnapshot,
  type PrimaryExposurePlatform
} from "@/lib/seller-report-store";
import { buildExposureAutoSnapshot, listExposureLinks } from "@/lib/seller-exposure-store";
import { buildMarketSnapshot } from "@/lib/seller-market-store";
import { buildCustomerSnapshot } from "@/lib/seller-customer-store";
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

  // 「從來沒被追蹤過」的空快照才重算——例如剛把網址填進曝光管理、追蹤器還沒跑過就建了週報，
  // 那份快照凍結的是「什麼都還沒有」，凍住它沒有任何意義，只會讓這份週報永遠顯示不出數據。
  // 真正有抓到數字的舊快照維持凍結不動，已經發給屋主的週報不會因為之後又抓到新數字而被改掉。
  const refreshedAutoSnapshots: Partial<Record<PrimaryExposurePlatform, ExposureAutoSnapshot>> = {};
  for (const platform of PRIMARY_EXPOSURE_PLATFORMS) {
    if (EXPOSURE_TRACKING_CAPABILITY[platform.key] === "manual") continue;
    if (!isUntrackedAutoSnapshot(report.exposure[platform.key]?.auto)) continue;
    const link = exposureLinks.find((l) => l.platform === platform.key);
    if (!link) continue;
    refreshedAutoSnapshots[platform.key] = await buildExposureAutoSnapshot(link, report.periodEnd);
  }

  // 編輯既有週報時，用這份報告「真正的週期」重新查一次目前的競品清單與統計數字——
  // 統計數字本身還是這次算出來的（不是凍結值），但預設勾選會把當初存進快照裡的那些也一併勾上，
  // 不會因為重算而讓她原本手動選的項目掉勾（見 ReportForm.tsx 的 selectedCompetitorIds 初始化邏輯）。
  const { stats: marketStats, competitors: marketCompetitors } = await buildMarketSnapshot(
    id,
    report.periodStart,
    report.periodEnd
  );

  // 編輯既有週報時用這份報告真正的週期重算客戶統計；預設勾選會把當初存進快照的也一併勾回來
  // （見 ReportForm.tsx 的 selectedRecordIds 初始化），不會因為重算而讓原本選的掉勾。
  const { stats: customerStats, records: customerRecords } = await buildCustomerSnapshot(
    id,
    report.periodStart,
    report.periodEnd,
    { inquiries: seller.baselineInquiries, viewings: seller.baselineViewings }
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
          autoSnapshots={refreshedAutoSnapshots}
          exposureLinks={exposureLinks}
          initialReport={report}
          customerRecords={customerRecords}
          customerStats={customerStats}
          marketCompetitors={marketCompetitors}
          marketStats={marketStats}
          sellerId={seller.id}
        />
      </main>
    </div>
  );
}
