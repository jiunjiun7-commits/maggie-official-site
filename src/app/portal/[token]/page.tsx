import { resolveSellerIdByToken } from "@/lib/seller-portal";
import { getSellerPublicInfo } from "@/lib/seller-store";
import { EXPOSURE_CHANNELS, listSellerReportsForPortal, type SellerReport } from "@/lib/seller-report-store";
import "./portal.css";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  active: "服務中",
  sold: "已成交",
  ended: "已結束"
};

function formatDate(value: string) {
  return value ? value.slice(0, 10) : "—";
}

function daysServed(start: string) {
  const days = Math.floor((Date.now() - new Date(start).getTime()) / 86_400_000);
  return Math.max(0, days);
}

export default async function SellerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sellerId = await resolveSellerIdByToken(token);

  if (!sellerId) {
    return (
      <div className="portal-page">
        <div className="portal-invalid">
          <h1>連結已失效</h1>
          <p>這組連結可能已經被重新產生或撤銷，請聯繫 Maggie 取得最新的專屬連結。</p>
        </div>
      </div>
    );
  }

  const seller = await getSellerPublicInfo(sellerId);
  if (!seller) {
    return (
      <div className="portal-page">
        <div className="portal-invalid">
          <h1>連結已失效</h1>
          <p>找不到對應的案件資料，請聯繫 Maggie 確認。</p>
        </div>
      </div>
    );
  }

  const reports = await listSellerReportsForPortal(sellerId);
  const [latest, ...history] = reports;

  return (
    <div className="portal-page">
      <div className="portal-shell">
        <header className="portal-header">
          <div className="portal-header-top">
            <h1>{seller.communityName}</h1>
            <span className={`tag status-${seller.status}`}>{STATUS_LABEL[seller.status]}</span>
          </div>
          <div className="portal-header-meta">
            <span>屋主：{seller.ownerNameMasked}</span>
            <span>目前開價：{seller.askingPrice || "—"}</span>
            <span>委託期間：{formatDate(seller.engagementStart)} ～ {formatDate(seller.engagementEnd)}</span>
            <span>已服務 {daysServed(seller.engagementStart)} 天</span>
            {latest ? <span>最新更新：{formatDate(latest.reportDate)}</span> : null}
          </div>
        </header>

        {latest ? (
          <section className="portal-report">
            <h2>最新週報｜{formatDate(latest.periodStart)} ～ {formatDate(latest.periodEnd)}</h2>
            <ReportBody report={latest} />
          </section>
        ) : (
          <section className="portal-report">
            <p>目前還沒有週報，Maggie 更新後會第一時間出現在這裡。</p>
          </section>
        )}

        {history.length ? (
          <section className="portal-history">
            <h2>歷史週報</h2>
            {history.map((report) => (
              <details className="portal-history-item" key={report.id}>
                <summary>
                  {formatDate(report.reportDate)} Seller Report（{formatDate(report.periodStart)} ～ {formatDate(report.periodEnd)}）
                </summary>
                <ReportBody report={report} />
              </details>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function ReportBody({ report }: { report: SellerReport }) {
  const exposureDone = EXPOSURE_CHANNELS.filter((c) => report.exposure[c.key]?.done);

  return (
    <div className="portal-report-body">
      <div className="portal-block">
        <h3>本週曝光</h3>
        {exposureDone.length ? (
          <ul className="portal-exposure-list">
            {exposureDone.map((c) => (
              <li key={c.key}>
                <strong>{c.label}</strong>
                {report.exposure[c.key]?.note ? <span>{report.exposure[c.key]?.note}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="portal-muted">本週尚無曝光紀錄。</p>
        )}
      </div>

      <div className="portal-block">
        <h3>本週詢問／帶看</h3>
        <div className="portal-stat-row">
          <div><span>{report.inquiriesWeek}</span>本週詢問</div>
          <div><span>{report.inquiriesTotal}</span>累積詢問</div>
          <div><span>{report.viewingsWeek}</span>本週帶看</div>
          <div><span>{report.viewingsTotal}</span>累積帶看</div>
          <div><span>{report.viewingsPending}</span>待安排帶看</div>
        </div>
      </div>

      {report.feedbackText ? (
        <div className="portal-block">
          <h3>客戶／同業回饋</h3>
          <p>{report.feedbackText}</p>
        </div>
      ) : null}

      {report.marketObservationText || report.marketListingsCount !== null ? (
        <div className="portal-block">
          <h3>市場觀察</h3>
          <div className="portal-stat-row">
            <div><span>{report.marketListingsCount ?? "—"}</span>社區在售</div>
            <div><span>{report.marketNewListings ?? "—"}</span>本週新增</div>
            <div><span>{report.marketPriceCuts ?? "—"}</span>本週降價</div>
            <div><span>{report.marketSoldCount ?? "—"}</span>本週成交</div>
          </div>
          {report.marketObservationText ? <p>{report.marketObservationText}</p> : null}
        </div>
      ) : null}

      {report.competitors.length ? (
        <div className="portal-block">
          <h3>競品</h3>
          <ul className="portal-competitor-list">
            {report.competitors.map((c, i) => (
              <li key={i}>
                <strong>{c.name}</strong>
                <span>{c.price} · {c.condition}</span>
                {c.url ? <a href={c.url} rel="noreferrer" target="_blank">查看物件</a> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.maggieNotes ? (
        <div className="portal-block">
          <h3>Maggie 本週觀察</h3>
          <p>{report.maggieNotes}</p>
        </div>
      ) : null}

      {report.nextWeekStrategy.checklist.length || report.nextWeekStrategy.note ? (
        <div className="portal-block">
          <h3>下週策略</h3>
          {report.nextWeekStrategy.checklist.length ? (
            <ul className="portal-checklist">
              {report.nextWeekStrategy.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {report.nextWeekStrategy.note ? <p>{report.nextWeekStrategy.note}</p> : null}
        </div>
      ) : null}

      {report.weeklyGoal ? (
        <div className="portal-block">
          <h3>本週目標</h3>
          <p>{report.weeklyGoal}</p>
        </div>
      ) : null}

      {report.ownerActionNeeded ? (
        <div className="portal-block portal-block-highlight">
          <h3>需要您配合</h3>
          <p>{report.ownerActionNeeded}</p>
        </div>
      ) : null}
    </div>
  );
}
