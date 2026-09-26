"use client";

import { useRef, useState } from "react";
import {
  CUSTOMER_RECORD_KINDS,
  CUSTOMER_RECORD_STATUSES,
  type CustomerRecord,
  type CustomerRecordKind,
  type CustomerRecordStatus
} from "@/lib/seller-customer-store";
import type { PromotionPhoto } from "@/lib/seller-report-store";

const MAX_RECORD_PHOTOS = 6;

function formatWhen(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/** timestamptz → datetime-local 輸入框要的 "YYYY-MM-DDTHH:mm"（本地時間）。 */
function toLocalInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nowLocalInput() {
  return toLocalInput(new Date().toISOString());
}

export default function CustomerRecordsPanel({
  sellerId,
  initialRecords
}: {
  sellerId: string;
  initialRecords: CustomerRecord[];
}) {
  const [records, setRecords] = useState(initialRecords);
  const [showForm, setShowForm] = useState(false);
  const [formKind, setFormKind] = useState<CustomerRecordKind>("customer");
  const [formStatus, setFormStatus] = useState<CustomerRecordStatus>("inquiry");
  const [newPhotos, setNewPhotos] = useState<PromotionPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  async function uploadPhoto(file: File): Promise<PromotionPhoto> {
    const formData = new FormData();
    formData.append("file", file);
    // 沿用既有的週報照片上傳 API 與同一個 Storage bucket，不另外建一套。
    const response = await fetch(`/api/sellers/${sellerId}/report-photos`, { method: "POST", body: formData });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "照片上傳失敗");
    return { url: payload.url, caption: "" };
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const photo = await uploadPhoto(file);
      setNewPhotos((current) => [...current, photo]);
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
    setBusy(true);
    try {
      const response = await fetch(`/api/sellers/${sellerId}/customer-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: formKind,
          status: formStatus,
          inquiredAt: form.get("inquiredAt"),
          viewedAt: form.get("viewedAt"),
          occurredAt: form.get("occurredAt"),
          customerAlias: form.get("customerAlias"),
          feedback: form.get("feedback"),
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
      setFormKind("customer");
      setFormStatus("inquiry");
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
      const response = await fetch(`/api/sellers/${sellerId}/customer-records/${recordId}`, {
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
      const response = await fetch(`/api/sellers/${sellerId}/customer-records/${recordId}`, {
        method: "DELETE"
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "刪除失敗");
      setRecords((current) => current.filter((r) => r.id !== recordId));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "刪除失敗");
    }
  }

  const trackingCount = records.filter(
    (r) => r.kind === "customer" && (r.status === "tracking" || r.status === "appointed")
  ).length;

  return (
    <section className="seller-panel">
      <div className="panel-head-row">
        <h2>客戶／銷售紀錄</h2>
        <button className="button-secondary" onClick={() => setShowForm((v) => !v)} type="button">
          {showForm ? "取消" : "＋ 新增紀錄"}
        </button>
      </div>
      <p className="market-competitors-hint">
        一位客戶一筆紀錄，狀態往前推進就好（詢問 → 追蹤中 → 已約帶看 → 實際帶看），不用每個階段開新的。
        建立週報時會自動統計，不用再重打數字。目前追蹤中 {trackingCount} 位。
      </p>

      {message ? <div className="form-error">{message}</div> : null}

      {showForm ? (
        <form className="market-competitor-form" onSubmit={submitCreate}>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="kind">紀錄類型</label>
              <select
                id="kind"
                onChange={(e) => setFormKind(e.target.value as CustomerRecordKind)}
                value={formKind}
              >
                {CUSTOMER_RECORD_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>{k.label}</option>
                ))}
              </select>
            </div>

            {formKind === "customer" ? (
              <>
                <div className="field">
                  <label htmlFor="status">目前狀態</label>
                  <select
                    id="status"
                    onChange={(e) => setFormStatus(e.target.value as CustomerRecordStatus)}
                    value={formStatus}
                  >
                    {CUSTOMER_RECORD_STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="inquiredAt">詢問時間</label>
                  <input defaultValue={nowLocalInput()} id="inquiredAt" name="inquiredAt" type="datetime-local" />
                </div>
                <div className="field">
                  <label htmlFor="viewedAt">實際帶看時間（狀態到「實際帶看」才需要）</label>
                  <input id="viewedAt" name="viewedAt" type="datetime-local" />
                </div>
                <div className="field">
                  <label htmlFor="customerAlias">客戶簡稱（選填，屋主看不到）</label>
                  <input id="customerAlias" name="customerAlias" placeholder="例如：陳小姐" />
                </div>
              </>
            ) : (
              <div className="field">
                <label htmlFor="occurredAt">發生時間</label>
                <input defaultValue={nowLocalInput()} id="occurredAt" name="occurredAt" type="datetime-local" />
              </div>
            )}

            <div className="field full">
              <label htmlFor="feedback">回饋內容（屋主看得到）</label>
              <textarea id="feedback" name="feedback" placeholder="例如：客戶喜歡採光與格局，但認為屋況需要整理。" />
            </div>
            <div className="field full">
              <label htmlFor="internalNote">內部備註（屋主絕對看不到）</label>
              <textarea id="internalNote" name="internalNote" placeholder="例如：出價 1,550，可再談" />
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
                {busy ? "儲存中..." : "新增紀錄"}
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
                <span className="platform-tag">
                  {CUSTOMER_RECORD_KINDS.find((k) => k.key === record.kind)?.label}
                </span>
                {record.customerAlias ? <strong>{record.customerAlias}</strong> : null}
                <span className="market-select-title">{record.feedback || "（未填回饋）"}</span>
                {!record.visibleToOwner ? <span className="cap-tag">不給屋主看</span> : null}
              </div>

              <div className="market-competitor-controls">
                {record.kind === "customer" ? (
                  <>
                    <select
                      onChange={(e) => patchRecord(record.id, { status: e.target.value })}
                      value={record.status}
                    >
                      {CUSTOMER_RECORD_STATUSES.map((s) => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                    <label className="checkbox-inline">
                      帶看時間
                      <input
                        defaultValue={toLocalInput(record.viewedAt)}
                        onBlur={(e) => {
                          const next = e.target.value;
                          if (next !== toLocalInput(record.viewedAt)) patchRecord(record.id, { viewedAt: next });
                        }}
                        type="datetime-local"
                      />
                    </label>
                  </>
                ) : (
                  <span className="market-competitor-tracked">{formatWhen(record.occurredAt)}</span>
                )}

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
        <div className="empty-state">還沒有任何紀錄。客戶詢問、帶看、同業回饋都記在這裡，週報就會自動帶入。</div>
      )}
    </section>
  );
}
