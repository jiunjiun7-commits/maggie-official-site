import { notFound } from "next/navigation";
import Sidebar from "@/app/admin/_components/Sidebar";
import { getSeller } from "@/lib/seller-store";
import { EXPOSURE_TRACKING_CAPABILITY, PRIMARY_EXPOSURE_PLATFORMS, type ExposureAutoSnapshot, type PrimaryExposurePlatform } from "@/lib/seller-report-store";
import { buildExposureAutoSnapshot, listExposureLinks } from "@/lib/seller-exposure-store";
import { buildMarketSnapshot } from "@/lib/seller-market-store";
import ReportForm from "../ReportForm";
import "../../../../login/login.css";
import "../../../sellers.css";

export const dynamic = "force-dynamic";

export default async function NewSellerReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seller = await getSeller(id);
  if (!seller) notFound();

  const exposureLinks = await listExposureLinks(id);

  // 建立新週報當下用「今天」當週期末算一次快照，凍結進表單初始值；之後改期間也不會重算，
  // 跟現有 Seller Report「一旦建立就固定」的精神一致。
  const today = new Date().toISOString().slice(0, 10);
  const autoSnapshots: Partial<Record<PrimaryExposurePlatform, ExposureAutoSnapshot>> = {};
  for (const platform of PRIMARY_EXPOSURE_PLATFORMS) {
    if (EXPOSURE_TRACKING_CAPABILITY[platform.key] === "manual") continue;
    const link = exposureLinks.find((l) => l.platform === platform.key);
    if (!link) continue;
    autoSnapshots[platform.key] = await buildExposureAutoSnapshot(link, today);
  }

  // 新週報還沒有實際期間，用最近 7 天當近似值算「本週有沒有變化」的預設勾選；
  // 送出表單時實際存進去的是使用者當下勾選的結果，不是這裡算出來就直接存檔。
  const approxPeriodStart = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const { stats: marketStats, competitors: marketCompetitors } = await buildMarketSnapshot(id, approxPeriodStart, today);

  return (
    <div className="admin-page">
      <Sidebar />
      <main className="admin-shell">
        <div className="admin-heading">
          <div>
            <h1>{seller.communityName}｜新增週報</h1>
            <p>
              <a href={`/admin/sellers/${seller.id}`} style={{ color: "var(--gold-400)" }}>← 回案件管理</a>
            </p>
          </div>
        </div>
        <ReportForm
          autoSnapshots={autoSnapshots}
          exposureLinks={exposureLinks}
          marketCompetitors={marketCompetitors}
          marketStats={marketStats}
          sellerId={seller.id}
        />
      </main>
    </div>
  );
}
