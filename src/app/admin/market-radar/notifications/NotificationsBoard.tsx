"use client";

import Link from "next/link";
import { useState } from "react";
import type { NotificationEvent } from "@/lib/market-radar-store";

function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("zh-TW");
}

const GEOCODE_MATCH_LABEL: Record<string, string> = {
  exact: "精確比對",
  normalized: "正規化後比對",
  approximate: "近似比對"
};

function describeGeocode(event: NotificationEvent): string {
  const sourceLabel = event.geocodeSource ? `來源：${event.geocodeSource}` : "來源：未記錄";
  const matchLabel = event.geocodeMatchStatus
    ? GEOCODE_MATCH_LABEL[event.geocodeMatchStatus] ?? event.geocodeMatchStatus
    : "";
  return matchLabel ? `${sourceLabel}｜${matchLabel}` : sourceLabel;
}

function describeMatchReason(event: NotificationEvent): string {
  return event.matchedAreas.map((a) => `命中「${a.areaName}」（${a.matchedRuleIds.length} 條規則）`).join("；");
}

/** 跟 LINE 訊息用同一套邏輯：能乾淨解析出「目前樓層/總樓層」才顯示這個格式，解析不出來就顯示原始文字（方便妳知道原始資料長怎樣）。 */
function describeFloor(event: NotificationEvent): string {
  if (event.floorNumber !== null && event.totalFloors !== null) return `${event.floorNumber}/${event.totalFloors}`;
  return event.floorRaw || "—";
}

type SendStatus = { success: boolean; error?: string };

export default function NotificationsBoard({ events: initialEvents }: { events: NotificationEvent[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [statusById, setStatusById] = useState<Map<string, SendStatus>>(new Map());
  const [message, setMessage] = useState("");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function sendSelected() {
    if (selected.size === 0) return;
    setSending(true);
    setMessage("");
    try {
      const response = await fetch("/api/market-radar/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ officialTransactionIds: [...selected] })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "發送失敗");

      const nextStatus = new Map(statusById);
      const succeededIds = new Set<string>();
      for (const r of payload.results as { officialTransactionId: string; success: boolean; error?: string }[]) {
        nextStatus.set(r.officialTransactionId, { success: r.success, error: r.error });
        if (r.success) succeededIds.add(r.officialTransactionId);
      }
      setStatusById(nextStatus);
      // 成功的事件已經寫入通知紀錄，從清單移除；失敗的留著方便重試。
      setEvents((prev) => prev.filter((e) => !succeededIds.has(e.officialTransactionId)));
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of succeededIds) next.delete(id);
        return next;
      });
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "發送失敗");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="admin-shell">
      <div className="admin-heading">
        <div>
          <h1>通知中心</h1>
          <p>
            列出所有監控區域中，尚未實際發送過通知的命中交易。一筆交易同時命中多個區域時，合併顯示成一筆事件，只會發一則
            LINE 通知，列出全部命中的區域。
          </p>
        </div>
        <Link className="button-secondary" href="/admin/market-radar/areas">
          區域管理
        </Link>
      </div>

      <div className="radar-panel">
        <p style={{ color: "#9fb0c7", fontSize: 13, marginTop: -6, marginBottom: 12 }}>
          待通知事件共 {events.length} 筆。勾選後按「發送測試通知」，逐筆各自呼叫 LINE
          推播、各自獨立判定成功或失敗——某一筆失敗不會影響其他筆。只有 LINE API
          回傳成功的事件，才會寫入通知紀錄並從這份清單移除；失敗的會留著，可以直接重試。
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <button className="button" disabled={sending || selected.size === 0} onClick={sendSelected} type="button">
            {sending ? "發送中..." : `發送測試通知（已選 ${selected.size} 筆）`}
          </button>
          {message ? <span className="form-error">{message}</span> : null}
        </div>

        {events.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="radar-table">
              <thead>
                <tr>
                  <th></th>
                  <th>命中區域</th>
                  <th>社區</th>
                  <th>地址</th>
                  <th>交易日期</th>
                  <th>總價</th>
                  <th>單價（元/坪）</th>
                  <th>建物坪數</th>
                  <th>樓層/總樓層</th>
                  <th>geocode / match 來源與原因</th>
                  <th>發送結果</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const status = statusById.get(event.officialTransactionId);
                  return (
                    <tr key={event.officialTransactionId}>
                      <td>
                        <input
                          checked={selected.has(event.officialTransactionId)}
                          disabled={sending}
                          onChange={() => toggle(event.officialTransactionId)}
                          type="checkbox"
                        />
                      </td>
                      <td>
                        {event.matchedAreas.map((a) => (
                          <span className="tag active-true" key={a.areaId} style={{ marginRight: 6 }}>
                            {a.areaName}
                          </span>
                        ))}
                      </td>
                      <td>{event.communityName ?? "—"}</td>
                      <td>{event.address}</td>
                      <td>{event.transactionDate ?? "—"}</td>
                      <td>{formatNumber(event.totalPrice)}</td>
                      <td>{formatNumber(event.unitPrice)}</td>
                      <td>{formatNumber(event.buildingAreaPing)}</td>
                      <td>{describeFloor(event)}</td>
                      <td style={{ fontSize: 12, color: "#9fb0c7" }}>
                        {describeGeocode(event)}
                        <br />
                        {describeMatchReason(event)}
                      </td>
                      <td style={{ fontSize: 12, color: status && !status.success ? "#e5647a" : "#9fb0c7" }}>
                        {status ? (status.success ? "✅ 已發送" : `❌ ${status.error ?? "失敗"}`) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">目前沒有待通知的事件。</div>
        )}
      </div>
    </main>
  );
}
