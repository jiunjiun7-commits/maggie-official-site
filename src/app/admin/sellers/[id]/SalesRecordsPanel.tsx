"use client";

import { useRef, useState } from "react";
import {
  SALES_RECORD_KINDS,
  kindHasGroups,
  kindLabel,
  type SalesRecord,
  type SalesRecordKind
} from "@/lib/seller-sales-store";
import type { PromotionPhoto } from "@/lib/seller-report-store";
import { isImplausibleYear, IMPLAUSIBLE_YEAR_MESSAGE } from "@/lib/date-guard";

const MAX_RECORD_PHOTOS = 6;

function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(value: string) {
  if (!value) return "—";
  return value.slice(5).replace("-", "/");
}

export default function SalesRecordsPanel({
  sellerId,
  initialRecords
}: {
  sellerId: string;
  initialRecords: SalesRecord[];
}) {
  const [records, setRecords] = useState(initialRecords);
  const [showForm, setShowForm] = useState(false);
  const [formKind, setFormKind] = useState<SalesRecordKind>("viewing");
  const [newPhotos, setNewPhotos] = useState<PromotionPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      // 沿用既有的週報照片上傳 API 與同一個 Storage bucket，不另外建一套。
      const response = await fetch(`/api/sellers/${sellerId}/report-photos`, { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "照片上傳失敗");
      setNewPhotos((current) => [...current, { url: payload.url, caption: "" }]);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "照片上傳失敗");
    } finally {
      setUploading(false);
    }
  }

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const occurredOn = String(form.get("occurredOn") || "");
    if (isImplausibleYear(occurredOn)) {
      setMessage(IMPLAUSIBLE_YEAR_MESSAGE);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/sellers/${sellerId}/sales-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: formKind,
          occurredOn,
          groupCount: form.get("groupCount"),
          summary: form.get("summary"),
          internalNote: form.get("internalNote"),
          photos: newPhotos,
          visibleToOwner: form.get("visibleToOwner") === "on"
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "新增失敗");
      setRecords((current) => [payload.record, ...current]);
      setShowForm(false);
      setNewPhotos([]);
      setFormKind("viewing");
      (event.target as HTMLFormElement).reset();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "新增失敗");
    } finally {
      setBusy(false);
    }
  }

  async function patchRecord(recordId: string, patch: Record<string, unknown>) {
    setMessage("");
    try {
      const response = await fetch(`/api/sellers/${sellerId}/sales-records/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "更新失敗");
      setRecords((current) => current.map((r) => (r.id === recordId ? payload.record : r)));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "更新失敗");
    }
  }

  async function removeRecord(recordId: string) {
    setMessage("");
    try {
      const response = await fetch(`/api/sellers/${sellerId}/sales-records/${recordId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "刪除失敗");
      setRecords((current) => current.filter((r) => r.id !== recordId));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "刪除失敗");
    }
  }

  return (
    <section className="seller-panel">
      <div className="panel-head-row">
        <h2>銷售紀錄</h2>
        <button className="button-secondary" onClick={() => setShowForm((v) => !v)} type="button">
          {showForm ? "取消" : "＋ 新增紀錄"}
        </button>
      </div>
      <p className="market-competitors-hint">
        一天記一筆就好：日期 → 組數 → 回饋摘要。建立週報時會自動加總，不用再重打數字。
        「已安排帶看」填的是預計看屋日期，等實際帶看記錄後會自動不再顯示給屋主。
      </p>

      {message ? <div className="form-error">{message}</div> : null}

      {showForm ? (
        <form className="market-competitor-form" onSubmit={submitCreate}>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="kind">類型</label>
              <select id="kind" onChange={(e) => setFormKind(e.target.value as SalesRecordKind)} value={formKind}>
                {SALES_RECORD_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>{k.label}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="occurredOn">
                {formKind === "appointment" ? "預計看屋日期" : "日期"}
              </label>
              <input defaultValue={today()} id="occurredOn" name="occurredOn" required type="date" />
            </div>

            {kindHasGroups(formKind) ? (
              <div className="field">
                <label htmlFor="groupCount">組數</label>
                <input defaultValue={1} id="groupCount" min={1} name="groupCount" type="number" />
              </div>
            ) : null}

            <div className="field full">
              <label htmlFor="summary">回饋摘要（屋主看得到）</label>
              <textarea
                id="summary"
                name="summary"
                placeholder="例如：一組喜歡採光與格局，但認為需要整理；另一組目前主要考量總價。"
              />
            </div>

            <div className="field full">
              <label htmlFor="internalNote">內部備註（選填，屋主絕對看不到）</label>
              <input id="internalNote" name="internalNote" placeholder="例如：出價 1,550，可再談" />
            </div>

            <div className="field full">
              <label>照片（選填）</label>
              {newPhotos.length ? (
                <div className="promotion-photo-grid">
                  {newPhotos.map((photo, index) => (
                    <div className="promotion-photo-card" key={photo.url}>
                      <img alt="" src={photo.url} />
                      <button
                        className="button-secondary"
                        onClick={() => setNewPhotos((c) => c.filter((_, i) => i !== index))}
                        type="button"
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <input
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={handlePhotoChange}
                ref={photoInputRef}
                type="file"
              />
              <button
                className="button-secondary"
                disabled={uploading || newPhotos.length >= MAX_RECORD_PHOTOS}
                onClick={() => photoInputRef.current?.click()}
                type="button"
              >
                {uploading ? "上傳中..." : `＋ 新增照片（${newPhotos.length}/${MAX_RECORD_PHOTOS}）`}
              </button>
            </div>

            <div className="field full">
              <label className="checkbox-inline">
                <input defaultChecked name="visibleToOwner" type="checkbox" />
                顯示給屋主
              </label>
            </div>

            <div className="field full">
              <button className="button" disabled={busy} type="submit">
                {busy ? "儲存中..." : "儲存"}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {records.length ? (
        <div className="market-competitor-list">
          {records.map((record) => (
            <div className="market-competitor-row" key={record.id}>
              <div className="market-competitor-main">
                <span className="cap-tag">{kindLabel(record.kind)}</span>
                <strong>{formatDate(record.occurredOn)}</strong>
                {record.groupCount !== null ? <span>{record.groupCount} 組</span> : null}
                <span className="market-select-title">{record.summary || "（未填摘要）"}</span>
                {record.photos.length ? <span className="market-select-badge">📷 {record.photos.length}</span> : null}
                {!record.visibleToOwner ? <span className="cap-tag">不給屋主看</span> : null}
              </div>

              <div className="market-competitor-controls">
                {kindHasGroups(record.kind) ? (
                  <label className="checkbox-inline">
                    組數
                    <input
                      defaultValue={record.groupCount ?? 1}
                      min={1}
                      onBlur={(e) => {
                        const next = Number(e.target.value);
                        if (next !== record.groupCount) patchRecord(record.id, { groupCount: next });
                      }}
                      style={{ width: 60 }}
                      type="number"
                    />
                  </label>
                ) : null}

                <label className="checkbox-inline">
                  <input
                    checked={record.visibleToOwner}
                    onChange={(e) => patchRecord(record.id, { visibleToOwner: e.target.checked })}
                    type="checkbox"
                  />
                  顯示給屋主
                </label>

                <button className="button-danger" onClick={() => removeRecord(record.id)} type="button">
                  刪除
                </button>
              </div>

              {record.internalNote ? (
                <div className="side-panel-note">內部備註：{record.internalNote}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          還沒有任何紀錄。帶看、詢問、同業回饋都記在這裡，建立週報時會自動帶入。
        </div>
      )}
    </section>
  );
}
