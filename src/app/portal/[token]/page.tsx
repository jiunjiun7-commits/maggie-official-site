import { resolveSellerIdByToken } from "@/lib/seller-portal";
import { getSellerPublicInfo } from "@/lib/seller-store";
import {
  EXPOSURE_AUTO_STATUS_LABEL,
  EXPOSURE_TRACKING_CAPABILITY,
  MANUAL_EXPOSURE_CHANNELS,
  PRIMARY_EXPOSURE_PLATFORMS,
  listSellerReportsForPortal,
  type PrimaryExposurePlatform as PrimaryExposurePlatformKey,
  type SellerReport
} from "@/lib/seller-report-store";
import { listExposureLinks } from "@/lib/seller-exposure-store";
import PromotionPhotoGallery from "./PromotionPhotoGallery";
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

function MARKET_BADGE_LABEL(badge: "new" | "price_cut" | "sold" | "delisted", priceDropWan?: number) {
  if (badge === "new") return "本週新增";
  if (badge === "price_cut") return priceDropWan !== undefined ? `本週降價 ${priceDropWan}萬` : "本週降價";
  if (badge === "sold") return "本週成交";
  return "已下架";
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

  // 人工紀錄的平台（樂屋網）沒有自動快照，沒有 activeDays 可用，卡片就會開天窗。
  // 這裡只取出「開始刊登日」算天數，刻意不把 listing_url 等內部設定值交給 Portal。
  const exposureStartedAt: Partial<Record<PrimaryExposurePlatformKey, string>> = {};
  for (const link of await listExposureLinks(sellerId)) {
    exposureStartedAt[link.platform as PrimaryExposurePlatformKey] = link.startedAt;
  }
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
            <ReportBody exposureStartedAt={exposureStartedAt} report={latest} />
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
                <ReportBody exposureStartedAt={exposureStartedAt} report={report} />
              </details>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}

/** ISO 時間 → 09/24，屋主端只需要看到月/日。 */
function formatMonthDay(value: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" });
}

function activeDaysUntil(startedAt: string | undefined, periodEnd: string) {
  if (!startedAt) return null;
  const days = Math.floor((new Date(periodEnd).getTime() - new Date(startedAt).getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

/** 剛上架當週算出來是 0 天，寫「已持續刊登 0 天」對屋主來說很奇怪，改講「本週完成上架」。 */
function describeActiveDays(days: number) {
  return days <= 0 ? "本週完成上架" : `已持續刊登 ${days} 天`;
}

function ReportBody({
  report,
  exposureStartedAt
}: {
  report: SellerReport;
  exposureStartedAt: Partial<Record<PrimaryExposurePlatformKey, string>>;
}) {
  const manualExposureDone = MANUAL_EXPOSURE_CHANNELS.filter((c) => report.exposure[c.key]?.done);

  return (
    <div className="portal-report-body">
      <div className="portal-block">
        <h3>主要平台曝光</h3>
        <div className="portal-primary-exposure-grid">
          {PRIMARY_EXPOSURE_PLATFORMS.map((platform) => {
            const entry = report.exposure[platform.key];
            const capability = EXPOSURE_TRACKING_CAPABILITY[platform.key];
            const auto = entry?.auto;

            if (capability === "manual") {
              if (!entry?.done) return null;
              // 人工紀錄沒有自動抓取的狀態與瀏覽數，但刊登天數仍然算得出來，
              // 補上這行才不會出現一張只有平台名稱、底下空白的卡片。
              const manualDays = activeDaysUntil(exposureStartedAt[platform.key], report.periodEnd);
              return (
                <div className="portal-primary-card" key={platform.key}>
                  <strong>{platform.label}</strong>
                  {manualDays !== null ? (
                    <span className="portal-primary-days">{describeActiveDays(manualDays)}</span>
                  ) : null}
                  {entry.note ? <span>{entry.note}</span> : null}
                </div>
              );
            }

            if (!auto) return null;
            return (
              <div className="portal-primary-card" key={platform.key}>
                <div className="portal-primary-card-top">
                  <strong>{platform.label}</strong>
                  <span>{EXPOSURE_AUTO_STATUS_LABEL[auto.status]}</span>
                </div>
                <span className="portal-primary-days">{describeActiveDays(auto.activeDays)}</span>
                {auto.cumulativeViews !== null ? (
                  <span>
                    累積瀏覽 {auto.cumulativeViews}
                    {auto.weeklyViewDelta !== null ? `｜本週新增 ${auto.weeklyViewDelta}` : ""}
                  </span>
                ) : (
                  <span>此平台未公開瀏覽數</span>
                )}
                {entry.note ? <span>{entry.note}</span> : null}
              </div>
            );
          })}
        </div>

        <h3 className="portal-secondary-heading">其他曝光</h3>
        {manualExposureDone.length ? (
          <ul className="portal-exposure-list">
            {manualExposureDone.map((c) => (
              <li key={c.key}>
                <strong>{c.label}</strong>
                {report.exposure[c.key]?.note ? <span>{report.exposure[c.key]?.note}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="portal-muted">本週尚無其他曝光紀錄。</p>
        )}
      </div>

      {report.promotionPhotos.length ? (
        <div className="portal-block">
          <h3>本週推廣紀錄</h3>
          <PromotionPhotoGallery photos={report.promotionPhotos} />
        </div>
      ) : null}

      {report.customerSnapshot.items.length || report.customerSnapshot.stats.viewingsWeek ? (
        <div className="portal-block">
          <h3>本週銷售進度</h3>
          <div className="portal-stat-row">
            <div><span>{report.customerSnapshot.stats.inquiriesWeek}</span>本週詢問</div>
            <div><span>{report.customerSnapshot.stats.tracking}</span>追蹤中</div>
            <div><span>{report.customerSnapshot.stats.viewingsWeek}</span>實際帶看</div>
            <div><span>{report.customerSnapshot.stats.viewingsTotal}</span>累積帶看</div>
          </div>
          {report.customerSnapshot.items.length ? (
            <ul className="portal-activity-list">
              {/* 依發生時間排序後再顯示——快照存進去的順序是建立紀錄的順序，
                  對屋主來說應該是一條照時間走的時間軸，不是後台的輸入順序。
                  在顯示時排序，既有的舊快照也會一併變整齊，不用回頭改資料。 */}
              {[...report.customerSnapshot.items]
                .sort((a, b) => (a.occurredAt || "").localeCompare(b.occurredAt || ""))
                .map((item) => (
                <li key={item.recordId}>
                  <div className="portal-activity-head">
                    <strong>{formatMonthDay(item.occurredAt)}｜{item.label}</strong>
                    {item.photos.length ? <span aria-label="有照片" role="img">📷</span> : null}
                  </div>
                  {item.feedback ? <p>{item.feedback}</p> : null}
                  {item.photos.length ? <PromotionPhotoGallery photos={item.photos} /> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
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
      )}

      {report.feedbackText ? (
        <div className="portal-block">
          <h3>客戶／同業回饋</h3>
          <p>{report.feedbackText}</p>
        </div>
      ) : null}

      {report.marketCompetitorSnapshot.items.length ? (
        <div className="portal-block">
          <h3>本週市場競品</h3>
          <div className="portal-stat-row">
            <div><span>{report.marketCompetitorSnapshot.stats.available}</span>目前追蹤在售</div>
            <div><span>{report.marketCompetitorSnapshot.stats.newThisWeek}</span>本週新增</div>
            <div><span>{report.marketCompetitorSnapshot.stats.priceCutThisWeek}</span>本週降價</div>
            <div><span>{report.marketCompetitorSnapshot.stats.soldThisWeek}</span>本週成交</div>
          </div>
          <ul className="portal-market-item-list">
            {report.marketCompetitorSnapshot.items.map((item) => (
              <li key={item.competitorId}>
                <span>
                  {item.platform}｜{item.title}｜{item.priceWan === null ? "面議" : `${item.priceWan.toLocaleString("zh-TW")}萬`}
                  {item.badge ? `｜${MARKET_BADGE_LABEL(item.badge, item.priceDropWan)}` : ""}
                </span>
                <a href={item.url} rel="noreferrer" target="_blank">查看物件</a>
              </li>
            ))}
          </ul>
          {report.marketObservationText ? <p>{report.marketObservationText}</p> : null}
        </div>
      ) : report.marketObservationText || report.marketListingsCount !== null ? (
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
                <span>
                  {[c.price, c.totalPing, c.layout, c.parking, c.condition]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
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
