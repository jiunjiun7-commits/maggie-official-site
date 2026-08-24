"use client";

import { useEffect, useRef, useState } from "react";
import L, { type LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import type { Bbox, Polygon } from "@/lib/market-radar-store";

const KAOHSIUNG_CENTER: LatLngTuple = [22.6396, 120.302];

// 「自由框選」這階段的 UI 操作固定為 6 個點，點完第 6 個點自動封閉完成。
// 這只是「畫的時候要點幾下」的操作限制，底層資料格式仍然是不限點數的 Polygon，
// schema／isPointInPolygon() 都沒有寫死成只能 6 點，之後要改成 8 點、10 點或不限點數，
// 只需要改這個常數／改掉下面的自動完成邏輯，不用動資料結構。
const FREEFORM_POINT_COUNT = 6;

const MUTED_STYLE = { color: "#7c8aa5", weight: 1.5, dashArray: "4 4", fillOpacity: 0.05 };
const ACTIVE_STYLE = { color: "#2f8fd6", weight: 3, fillOpacity: 0.18, dashArray: undefined };

export type MapRule = { id: string; ruleType: "bbox" | "polygon"; bbox: Bbox | null; polygon: Polygon | null };

type Selection =
  | { kind: "new"; ruleType: "bbox" | "polygon"; layer: L.Layer }
  | { kind: "existing"; ruleId: string; layer: L.Layer; snapshot: LatLngTuple[][] };

function haversineMeters(a: LatLngTuple, b: LatLngTuple) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatMeters(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} 公里` : `${m.toFixed(0)} 公尺`;
}

/** 把 layer（矩形或自由形狀）目前的幾何取出來，統一成一圈頂點陣列，供量測邊長／存檔用。 */
function layerToRing(layer: L.Layer): LatLngTuple[] {
  if (layer instanceof L.Rectangle) {
    const b = layer.getBounds();
    return [
      [b.getNorth(), b.getWest()],
      [b.getNorth(), b.getEast()],
      [b.getSouth(), b.getEast()],
      [b.getSouth(), b.getWest()]
    ];
  }
  if (layer instanceof L.Polygon) {
    const latlngs = layer.getLatLngs();
    const ring = (Array.isArray(latlngs[0]) ? latlngs[0] : latlngs) as L.LatLng[];
    return ring.map((p) => [p.lat, p.lng]);
  }
  return [];
}

function bboxToRing(bbox: Bbox): [LatLngTuple, LatLngTuple] {
  return [
    [bbox.north, bbox.west],
    [bbox.south, bbox.east]
  ];
}

function polygonToLatLngTuples(polygon: Polygon): LatLngTuple[] {
  return polygon.map((p) => [p.lat, p.lng]);
}

function ringToBbox(ring: LatLngTuple[]): Bbox {
  const lats = ring.map((p) => p[0]);
  const lngs = ring.map((p) => p[1]);
  return { north: Math.max(...lats), south: Math.min(...lats), east: Math.max(...lngs), west: Math.min(...lngs) };
}

function ringToPolygon(ring: LatLngTuple[]): Polygon {
  return ring.map(([lat, lng]) => ({ lat, lng }));
}

function rangeLabel(rule: MapRule, index: number) {
  return `範圍 ${index + 1}（${rule.ruleType === "bbox" ? "矩形" : "自由形狀"}）`;
}

export default function AreaMapModal({
  areaName,
  open,
  rules,
  busy,
  onClose,
  onCreate,
  onUpdate,
  onDelete
}: {
  areaName: string;
  open: boolean;
  rules: MapRule[];
  busy: boolean;
  onClose: () => void;
  onCreate: (input: { ruleType: "bbox" | "polygon"; bbox?: Bbox; polygon?: Polygon }) => Promise<boolean>;
  onUpdate: (ruleId: string, input: { bbox?: Bbox; polygon?: Polygon }) => Promise<boolean>;
  onDelete: (ruleId: string) => Promise<void>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersByRuleId = useRef(new Map<string, L.Layer>());
  const labelsByLayer = useRef(new Map<L.Layer, L.LayerGroup>());
  const selectionRef = useRef<Selection | null>(null);
  const savingRef = useRef(false);
  const fittedOnce = useRef(false);
  const draggingWholeRef = useRef(false);
  const handlersAttached = useRef(new WeakSet<L.Layer>());
  const redrawReplaceRef = useRef<{ ruleId: string; snapshot: LatLngTuple[][] } | null>(null);
  const freeformClickCleanupRef = useRef<(() => void) | null>(null);
  const onCreateRef = useRef(onCreate);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  onCreateRef.current = onCreate;
  onUpdateRef.current = onUpdate;
  onDeleteRef.current = onDelete;

  const [selection, setSelection] = useState<Selection | null>(null);
  const [vertexCount, setVertexCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draggingWhole, setDraggingWhole] = useState(false);
  const [drawingType, setDrawingType] = useState<"bbox" | "polygon" | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  function refreshLabels(layer: L.Layer) {
    const map = mapRef.current;
    if (!map) return;
    const existing = labelsByLayer.current.get(layer);
    if (existing) map.removeLayer(existing);

    const ring = layerToRing(layer);
    if (ring.length < 2) return;
    const group = L.layerGroup();
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const distance = haversineMeters(a, b);
      const mid: LatLngTuple = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const icon = L.divIcon({ className: "area-map-distance-label", html: formatMeters(distance), iconSize: undefined });
      L.marker(mid, { icon, interactive: false, keyboard: false }).addTo(group);
    }
    group.addTo(map);
    labelsByLayer.current.set(layer, group);
  }

  function clearLabels(layer: L.Layer) {
    const map = mapRef.current;
    const group = labelsByLayer.current.get(layer);
    if (group && map) map.removeLayer(group);
    labelsByLayer.current.delete(layer);
  }

  function updateVertexCountFromLayer(layer: L.Layer) {
    setVertexCount(layerToRing(layer).length);
  }

  function styleLayer(layer: L.Layer, active: boolean) {
    if (layer instanceof L.Path) layer.setStyle(active ? ACTIVE_STYLE : MUTED_STYLE);
  }

  function deselect() {
    const sel = selectionRef.current;
    if (sel) {
      const layer = sel.layer as any;
      if (layer.pm) {
        layer.pm.disable();
        if (layer.pm.disableLayerDrag) layer.pm.disableLayerDrag();
      }
      clearLabels(sel.layer);
      if (sel.kind === "new") {
        mapRef.current?.removeLayer(sel.layer);
      } else {
        styleLayer(sel.layer, false);
      }
    }
    selectionRef.current = null;
    draggingWholeRef.current = false;
    redrawReplaceRef.current = null;
    setSelection(null);
    setVertexCount(0);
    setDraggingWhole(false);
  }

  function attachLiveGeometryHandlers(layer: L.Layer) {
    if (handlersAttached.current.has(layer)) return;
    handlersAttached.current.add(layer);
    const handler = () => {
      refreshLabels(layer);
      updateVertexCountFromLayer(layer);
    };
    layer.on("pm:edit", handler);
    layer.on("pm:markerdragend", handler);
    layer.on("pm:vertexadded", handler);
    layer.on("pm:dragend", handler);
  }

  function selectExisting(ruleId: string, layer: L.Layer) {
    if (savingRef.current) return;
    if (selectionRef.current) {
      if (selectionRef.current.kind === "existing" && selectionRef.current.ruleId === ruleId) return;
      deselect();
    }
    const snapshot: LatLngTuple[][] = [layerToRing(layer)];
    const sel: Selection = { kind: "existing", ruleId, layer, snapshot };
    selectionRef.current = sel;
    draggingWholeRef.current = false;
    setSelection(sel);
    setDraggingWhole(false);
    styleLayer(layer, true);
    const anyLayer = layer as any;
    // 頂點編輯（enable）跟整體移動（enableLayerDrag）在 Geoman 裡是互斥模式，
    // enableLayerDrag() 內部會先關掉頂點編輯——不能兩個同時開，預設先進頂點編輯模式，
    // 整體移動另外用「移動整個範圍」切換鈕處理。
    anyLayer.pm.enable();
    attachLiveGeometryHandlers(layer);
    refreshLabels(layer);
    updateVertexCountFromLayer(layer);
  }

  function toggleWholeShapeDrag() {
    const sel = selectionRef.current;
    if (!sel) return;
    const anyLayer = sel.layer as any;
    if (draggingWholeRef.current) {
      anyLayer.pm.disableLayerDrag();
      anyLayer.pm.enable();
      draggingWholeRef.current = false;
      setDraggingWhole(false);
    } else {
      anyLayer.pm.enableLayerDrag();
      draggingWholeRef.current = true;
      setDraggingWhole(true);
    }
    refreshLabels(sel.layer);
    updateVertexCountFromLayer(sel.layer);
  }

  function buildLayerForRule(rule: MapRule): L.Layer | null {
    if (rule.ruleType === "bbox" && rule.bbox) return L.rectangle(bboxToRing(rule.bbox), MUTED_STYLE);
    if (rule.ruleType === "polygon" && rule.polygon) return L.polygon(polygonToLatLngTuples(rule.polygon), MUTED_STYLE);
    return null;
  }

  function clearFreeformClickCounter() {
    freeformClickCleanupRef.current?.();
    freeformClickCleanupRef.current = null;
  }

  /** 以目前地圖畫面中心，算出一個預設六邊形（大小抓目前可視範圍的一部分），供「自由框選」一開始就有形狀可以調整。 */
  function buildDefaultHexagon(map: L.Map): LatLngTuple[] {
    const center = map.getCenter();
    const bounds = map.getBounds();
    const rLat = (bounds.getNorth() - bounds.getSouth()) * 0.18;
    const rLng = (bounds.getEast() - bounds.getWest()) * 0.18;
    const points: LatLngTuple[] = [];
    for (let i = 0; i < FREEFORM_POINT_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / FREEFORM_POINT_COUNT - Math.PI / 2;
      points.push([center.lat + Math.sin(angle) * rLat, center.lng + Math.cos(angle) * rLng]);
    }
    return points;
  }

  /** 「自由框選」：不用使用者手動一點一點點，按下去就直接生出一個預設六邊形＋6 個可拖曳節點，使用者只要調整位置即可。 */
  function startFreeform() {
    const map = mapRef.current;
    if (!map) return;
    if (selectionRef.current) deselect();

    const points = buildDefaultHexagon(map);
    const layer = L.polygon(points, ACTIVE_STYLE);
    layer.addTo(map);
    const anyLayer = layer as any;
    anyLayer.pm.enable();
    attachLiveGeometryHandlers(layer);

    const sel: Selection = { kind: "new", ruleType: "polygon", layer };
    selectionRef.current = sel;
    draggingWholeRef.current = false;
    setSelection(sel);
    setDraggingWhole(false);
    refreshLabels(layer);
    updateVertexCountFromLayer(layer);
  }

  function startDraw(type: "bbox" | "polygon") {
    if (type === "polygon") {
      startFreeform();
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    if (selectionRef.current) deselect();
    clearFreeformClickCounter();
    map.pm.enableDraw("Rectangle");
  }

  function cancelDrawing() {
    const map = mapRef.current;
    if (!map || !drawingType) return;
    clearFreeformClickCounter();
    map.pm.disableDraw(drawingType === "bbox" ? "Rectangle" : "Polygon");
  }

  /** 目前這個範圍不滿意，整個丟掉重畫；既有範圍會記住原本的樣子，重畫完取消還是能回到最一開始存檔的樣子。 */
  function handleRedraw() {
    const sel = selectionRef.current;
    if (!sel) return;
    const type: "bbox" | "polygon" = sel.kind === "new" ? sel.ruleType : sel.layer instanceof L.Rectangle ? "bbox" : "polygon";
    if (sel.kind === "existing") {
      redrawReplaceRef.current = { ruleId: sel.ruleId, snapshot: sel.snapshot };
    }
    const anyLayer = sel.layer as any;
    if (anyLayer.pm) {
      anyLayer.pm.disable();
      if (anyLayer.pm.disableLayerDrag) anyLayer.pm.disableLayerDrag();
    }
    clearLabels(sel.layer);
    mapRef.current?.removeLayer(sel.layer);
    selectionRef.current = null;
    draggingWholeRef.current = false;
    setSelection(null);
    setVertexCount(0);
    setDraggingWhole(false);
    startDraw(type);
  }

  // 初始化地圖。Modal 關閉時整個元件會 return null（容器 div 不存在），依賴 open 讓 Modal
  // 重新打開時容器 div 一出現就能重新建立地圖，不會因為「只在第一次掛載時執行一次」而抓不到容器。
  useEffect(() => {
    if (!open || !containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(KAOHSIUNG_CENTER, 14);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // 畫圖過程中滑鼠旁邊跟著跑的提示文字，改成白話中文，不出現「頂點」「多邊形」這種工程詞彙。
    // 內建繁中翻譯（zh_tw）本身還是有「頂點」「多邊形」字眼，這裡直接覆蓋成一般人看得懂的說法。
    map.pm.setLang(
      "zh_tw",
      {
        tooltips: {
          firstVertex: "點一下地圖，開始畫範圍",
          continueLine: "繼續點出範圍的邊界",
          finishPoly: "點回第一個點，完成範圍",
          finishRect: "放開滑鼠，完成範圍"
        },
        actions: {
          finish: "完成",
          cancel: "取消",
          removeLastVertex: "移除最後一點"
        }
      },
      "zh_tw"
    );

    // 不用 Geoman 內建工具列（圖示＋英文 tooltip），改用畫面上自己做的中文按鈕觸發同一套繪製功能。
    map.on("pm:drawstart", (e: any) => {
      setDrawingType(e.shape === "Rectangle" ? "bbox" : "polygon");
    });
    map.on("pm:drawend", () => {
      setDrawingType(null);
      clearFreeformClickCounter();
    });

    map.on("pm:create", (e: any) => {
      const layer = e.layer as L.Layer;
      const ruleType: "bbox" | "polygon" = e.shape === "Rectangle" ? "bbox" : "polygon";
      styleLayer(layer, true);
      const anyLayer = layer as any;
      anyLayer.pm.enable();
      attachLiveGeometryHandlers(layer);

      const pendingReplace = redrawReplaceRef.current;
      redrawReplaceRef.current = null;
      const sel: Selection = pendingReplace
        ? { kind: "existing", ruleId: pendingReplace.ruleId, layer, snapshot: pendingReplace.snapshot }
        : { kind: "new", ruleType, layer };

      selectionRef.current = sel;
      draggingWholeRef.current = false;
      setSelection(sel);
      setDraggingWhole(false);
      refreshLabels(layer);
      updateVertexCountFromLayer(layer);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      layersByRuleId.current.clear();
      labelsByLayer.current.clear();
      handlersAttached.current = new WeakSet<L.Layer>();
      fittedOnce.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 依 rules 同步既有範圍對應的地圖圖層（新增/刪除/更新幾何），不動目前正在編輯中的那一個。
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(rules.map((r) => r.id));
    for (const [ruleId, layer] of layersByRuleId.current.entries()) {
      if (!currentIds.has(ruleId)) {
        if (selectionRef.current?.kind === "existing" && selectionRef.current.ruleId === ruleId) deselect();
        clearLabels(layer);
        map.removeLayer(layer);
        layersByRuleId.current.delete(ruleId);
      }
    }

    for (const rule of rules) {
      const isEditingThis = selectionRef.current?.kind === "existing" && selectionRef.current.ruleId === rule.id;
      if (isEditingThis) continue;

      const existingLayer = layersByRuleId.current.get(rule.id);
      if (existingLayer) {
        map.removeLayer(existingLayer);
        layersByRuleId.current.delete(rule.id);
      }
      const layer = buildLayerForRule(rule);
      if (!layer) continue;
      layer.addTo(map);
      layer.on("click", () => selectExisting(rule.id, layer));
      layersByRuleId.current.set(rule.id, layer);
    }

    if (!fittedOnce.current && rules.length > 0) {
      const allPoints: LatLngTuple[] = [];
      for (const rule of rules) {
        if (rule.bbox) allPoints.push(...bboxToRing(rule.bbox));
        if (rule.polygon) allPoints.push(...polygonToLatLngTuples(rule.polygon));
      }
      if (allPoints.length > 0) {
        map.fitBounds(allPoints, { padding: [32, 32] });
        fittedOnce.current = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, open]);

  // Modal 打開後，地圖容器尺寸才確定，補一次 invalidateSize 避免地圖顯示不完整。
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => mapRef.current?.invalidateSize(), 60);
    return () => window.clearTimeout(id);
  }, [open]);

  async function handleSave() {
    const sel = selectionRef.current;
    if (!sel) return;
    setSaving(true);
    savingRef.current = true;
    try {
      const ring = layerToRing(sel.layer);
      const geometry =
        sel.kind === "new"
          ? sel.ruleType === "bbox"
            ? { bbox: ringToBbox(ring) }
            : { polygon: ringToPolygon(ring) }
          : sel.layer instanceof L.Rectangle
            ? { bbox: ringToBbox(ring) }
            : { polygon: ringToPolygon(ring) };

      const ok =
        sel.kind === "new"
          ? await onCreateRef.current({ ruleType: sel.ruleType, ...geometry })
          : await onUpdateRef.current(sel.ruleId, geometry);

      if (ok) deselect();
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }

  function handleCancel() {
    if (savingRef.current) return;
    if (selectionRef.current?.kind === "existing") {
      const sel = selectionRef.current;
      const ring = sel.snapshot[0];
      if (sel.layer instanceof L.Rectangle) sel.layer.setBounds(L.latLngBounds(ring[0], ring[2]));
      else if (sel.layer instanceof L.Polygon) sel.layer.setLatLngs(ring);
    }
    deselect();
  }

  async function handleDeleteRule(rule: MapRule, index: number) {
    const confirmed = window.confirm(`確定要刪除「${rangeLabel(rule, index)}」嗎？刪除後無法復原。`);
    if (!confirmed) return;
    setDeletingId(rule.id);
    try {
      if (selectionRef.current?.kind === "existing" && selectionRef.current.ruleId === rule.id) deselect();
      await onDeleteRef.current(rule.id);
    } finally {
      setDeletingId(null);
    }
  }

  function handleRequestClose() {
    if (selectionRef.current) {
      const confirmed = window.confirm("有未儲存的變更，確定要離開嗎？離開後這次的變更不會被存起來。");
      if (!confirmed) return;
      deselect();
    }
    onClose();
  }

  if (!open) return null;

  const isBusy = busy || saving || deletingId !== null;

  return (
    <div className="area-map-modal-overlay" onClick={(e) => e.target === e.currentTarget && handleRequestClose()}>
      <div className="area-map-modal">
        <div className="area-map-modal-header">
          <strong>{areaName} — 地圖範圍設定</strong>
          <button aria-label="關閉" className="area-map-modal-close" onClick={handleRequestClose} type="button">
            ✕
          </button>
        </div>

        <div className="area-map-modal-toolbar">
          <button className="button" disabled={isBusy || drawingType !== null || selection !== null} onClick={() => startDraw("bbox")} type="button">
            快速框選
          </button>
          <button className="button" disabled={isBusy || drawingType !== null || selection !== null} onClick={() => startDraw("polygon")} type="button">
            自由框選
          </button>
          {drawingType ? (
            <span className="area-map-modal-drawing-hint">
              在地圖上按住滑鼠拖曳，放開就完成
              <button className="button-secondary" onClick={cancelDrawing} type="button">
                取消畫這個範圍
              </button>
            </span>
          ) : (
            <span className="area-map-modal-hint">
              「自由框選」按下去會直接出現一個可調整的範圍；點地圖上任一個既有範圍也可以直接開始調整
            </span>
          )}
        </div>

        <div className="area-map-modal-body">
          <div className={`area-map-modal-sidebar${sidebarCollapsed ? " collapsed" : ""}`}>
            <button
              aria-label={sidebarCollapsed ? "展開清單" : "收合清單"}
              className="area-map-modal-sidebar-toggle"
              onClick={() => setSidebarCollapsed((v) => !v)}
              type="button"
            >
              {sidebarCollapsed ? "»" : "«"}
            </button>
            {!sidebarCollapsed ? (
              <div className="area-map-modal-sidebar-list">
                <div className="area-map-modal-sidebar-count">共 {rules.length} 個範圍</div>
                {rules.map((rule, index) => (
                  <div
                    className={`area-map-modal-sidebar-item${selection?.kind === "existing" && selection.ruleId === rule.id ? " active" : ""}`}
                    key={rule.id}
                  >
                    <button
                      className="area-map-modal-sidebar-item-label"
                      disabled={isBusy}
                      onClick={() => {
                        const layer = layersByRuleId.current.get(rule.id);
                        if (layer) selectExisting(rule.id, layer);
                      }}
                      type="button"
                    >
                      {rangeLabel(rule, index)}
                    </button>
                    <button
                      aria-label={`刪除${rangeLabel(rule, index)}`}
                      className="area-map-modal-sidebar-item-delete"
                      disabled={isBusy}
                      onClick={() => handleDeleteRule(rule, index)}
                      type="button"
                    >
                      {deletingId === rule.id ? "…" : "🗑"}
                    </button>
                  </div>
                ))}
                {rules.length === 0 ? <div className="area-map-modal-sidebar-empty">還沒有任何範圍，用上面的按鈕開始畫</div> : null}
              </div>
            ) : null}
          </div>

          <div className="area-map-modal-map-wrap">
            <div className="area-map-modal-map" ref={containerRef} />

            {selection ? (
              <div className="area-map-modal-edit-bar">
                <strong>
                  {selection.kind === "new"
                    ? `新範圍（尚未儲存）`
                    : `正在調整：${rangeLabel(
                        { id: selection.ruleId, ruleType: selection.layer instanceof L.Rectangle ? "bbox" : "polygon", bbox: null, polygon: null },
                        rules.findIndex((r) => r.id === selection.ruleId)
                      )}`}
                </strong>
                <div className="area-map-modal-edit-actions">
                  <button className="button-secondary" disabled={isBusy} onClick={toggleWholeShapeDrag} type="button">
                    {draggingWhole ? "改成調整節點" : "移動整個範圍"}
                  </button>
                  <button className="button-secondary" disabled={isBusy} onClick={handleRedraw} type="button">
                    重新繪製
                  </button>
                  <button className="button-secondary" disabled={isBusy} onClick={handleCancel} type="button">
                    取消
                  </button>
                  <button className="button" disabled={isBusy} onClick={handleSave} type="button">
                    {saving ? "儲存中..." : "儲存範圍"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
