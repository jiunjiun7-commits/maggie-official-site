"use client";

import { useState } from "react";
import {
  EXPOSURE_CAPABILITY_LABEL,
  EXPOSURE_TRACKING_CAPABILITY,
  PRIMARY_EXPOSURE_PLATFORMS,
  type PrimaryExposurePlatform
} from "@/lib/seller-report-store";
import type { ExposureLink } from "@/lib/seller-exposure-store";
import { isImplausibleYear, IMPLAUSIBLE_YEAR_MESSAGE } from "@/lib/date-guard";

const STATUS_LABEL: Record<ExposureLink["currentStatus"], string> = {
  normal: "🟢 正常曝光",
  inactive: "🔴 原刊登網址已失效",
  unverifiable: "⚪ 無法自動驗證"
};

function formatCheckedAt(value: string | null) {
  if (!value) return "尚未檢查";
  return new Date(value).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function ExposureLinksPanel({
  sellerId,
  initialLinks
}: {
  sellerId: string;
  initialLinks: ExposureLink[];
}) {
  const [links, setLinks] = useState(initialLinks);
  const [busyPlatform, setBusyPlatform] = useState<string>("");
  const [message, setMessage] = useState("");

  function linkFor(platform: PrimaryExposurePlatform) {
    return links.find((l) => l.platform === platform) ?? null;
  }

  async function submit(platform: PrimaryExposurePlatform, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const startedAt = String(form.get("startedAt") || "");
    if (isImplausibleYear(startedAt)) {
      setMessage(IMPLAUSIBLE_YEAR_MESSAGE);
      return;
    }

    setBusyPlatform(platform);
    try {
      const response = await fetch(`/api/sellers/${sellerId}/exposure-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          listingUrl: form.get("listingUrl"),
          startedAt,
          manualNote: form.get("manualNote")
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "儲存失敗");
      setLinks((current) => [...current.filter((l) => l.platform !== platform), payload.link]);
      setMessage(`${platform} 曝光追蹤設定已儲存。`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "儲存失敗");
    } finally {
      setBusyPlatform("");
    }
  }

  return (
    <section className="seller-panel">
      <h2>曝光管理</h2>
      <p className="exposure-links-hint">
        591／5168／樂屋網／官網固定四個，網址與開始刊登日期只要設定一次，之後每週建立 Seller Report 會自動帶入追蹤結果，不用每週重填。
      </p>

      {message ? <div className="form-error">{message}</div> : null}

      <div className="exposure-links-grid">
        {PRIMARY_EXPOSURE_PLATFORMS.map((platform) => {
          const capability = EXPOSURE_TRACKING_CAPABILITY[platform.key];
          const link = linkFor(platform.key);
          const busy = busyPlatform === platform.key;

          return (
            <form
              className="exposure-link-card"
              key={platform.key}
              onSubmit={(e) => submit(platform.key, e)}
            >
              <div className="exposure-link-card-top">
                <strong>{platform.label}</strong>
                <span className="cap-tag">{EXPOSURE_CAPABILITY_LABEL[capability]}</span>
              </div>

              {capability !== "manual" ? (
                <div className="field">
                  <label htmlFor={`url-${platform.key}`}>刊登網址</label>
                  <input
                    defaultValue={link?.listingUrl ?? ""}
                    id={`url-${platform.key}`}
                    name="listingUrl"
                    placeholder="https://..."
                    required
                    type="url"
                  />
                </div>
              ) : (
                <div className="field">
                  <label htmlFor={`url-${platform.key}`}>刊登網址（選填）</label>
                  <input defaultValue={link?.listingUrl ?? ""} id={`url-${platform.key}`} name="listingUrl" placeholder="https://...（可留空）" type="url" />
                </div>
              )}

              <div className="field">
                <label htmlFor={`start-${platform.key}`}>開始刊登日期</label>
                <input defaultValue={link?.startedAt ?? ""} id={`start-${platform.key}`} name="startedAt" required type="date" />
              </div>

              <div className="field">
                <label htmlFor={`note-${platform.key}`}>{capability === "manual" ? "備註" : "人工補充說明"}（選填）</label>
                <input
                  defaultValue={link?.manualNote ?? ""}
                  id={`note-${platform.key}`}
                  name="manualNote"
                  placeholder={capability === "manual" ? "例如：8/3 上架" : "例如：更新首圖、調整標題、重新曝光"}
                />
              </div>

              {capability !== "manual" && link ? (
                <div className="exposure-link-status">
                  <span>{STATUS_LABEL[link.currentStatus]}</span>
                  {link.currentStatus === "inactive" ? <span>請確認是否下架、換網址或重新刊登</span> : null}
                  <span className="checked-at">最後檢查：{formatCheckedAt(link.lastCheckedAt)}</span>
                </div>
              ) : null}

              <button className="button-secondary" disabled={busy} type="submit">
                {busy ? "儲存中..." : link ? "更新設定" : "儲存設定"}
              </button>
            </form>
          );
        })}
      </div>
    </section>
  );
}
