"use client";

import { useEffect, useState } from "react";
import { MapContainer, Rectangle, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Bbox } from "@/lib/market-radar-store";

const KAOHSIUNG_CENTER: LatLngTuple = [22.6396, 120.302];
const MIN_SPAN = 0.0008; // 約 90 公尺，避免手滑點一下就算框選成功

function FitToBbox({ bbox }: { bbox: Bbox | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bbox) return;
    map.fitBounds(
      [
        [bbox.north, bbox.east],
        [bbox.south, bbox.west]
      ],
      { padding: [24, 24] }
    );
    // 只在外部帶入新的 bbox（例如切換編輯中的區域）時重新對焦，使用者自己框選時不要打斷視角
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbox?.north, bbox?.south, bbox?.east, bbox?.west]);
  return null;
}

function DrawLayer({
  active,
  onDrawEnd
}: {
  active: boolean;
  onDrawEnd: (bbox: Bbox) => void;
}) {
  const [start, setStart] = useState<LatLngTuple | null>(null);
  const [current, setCurrent] = useState<LatLngTuple | null>(null);

  const map = useMapEvents({
    mousedown(event) {
      if (!active) return;
      setStart([event.latlng.lat, event.latlng.lng]);
      setCurrent([event.latlng.lat, event.latlng.lng]);
    },
    mousemove(event) {
      if (!active || !start) return;
      setCurrent([event.latlng.lat, event.latlng.lng]);
    },
    mouseup() {
      if (!active || !start || !current) return;
      const north = Math.max(start[0], current[0]);
      const south = Math.min(start[0], current[0]);
      const east = Math.max(start[1], current[1]);
      const west = Math.min(start[1], current[1]);
      if (north - south >= MIN_SPAN && east - west >= MIN_SPAN) {
        onDrawEnd({ north, south, east, west });
      }
      setStart(null);
      setCurrent(null);
    }
  });

  useEffect(() => {
    if (active) {
      map.dragging.disable();
    } else {
      map.dragging.enable();
    }
    return () => {
      map.dragging.enable();
    };
  }, [active, map]);

  if (!start || !current) return null;
  return (
    <Rectangle
      bounds={[start, current]}
      pathOptions={{ color: "#2f8fd6", weight: 2, fillOpacity: 0.15 }}
    />
  );
}

export default function MapAreaPicker({
  value,
  onChange
}: {
  value: Bbox | null;
  onChange: (bbox: Bbox | null) => void;
}) {
  const [drawMode, setDrawMode] = useState(!value);

  function handleDrawEnd(bbox: Bbox) {
    onChange(bbox);
    setDrawMode(false);
  }

  function updateField(field: keyof Bbox, raw: string) {
    if (!value) return;
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    onChange({ ...value, [field]: num });
  }

  return (
    <div className="map-area-picker">
      <div className="map-area-picker-toolbar">
        <button
          className={drawMode ? "button" : "button-secondary"}
          onClick={() => setDrawMode((v) => !v)}
          type="button"
        >
          {drawMode ? "框選中（拖曳滑鼠畫矩形）" : "重新框選"}
        </button>
        {value ? (
          <button className="button-secondary" onClick={() => onChange(null)} type="button">
            清除框選範圍
          </button>
        ) : null}
        <span className="map-area-picker-hint">
          {drawMode ? "在地圖上按住滑鼠左鍵拖曳，放開即完成框選" : "地圖可自由拖曳查看範圍，按「重新框選」可再畫一次"}
        </span>
      </div>

      <div className="map-area-picker-map">
        <MapContainer center={KAOHSIUNG_CENTER} zoom={13} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitToBbox bbox={value} />
          <DrawLayer active={drawMode} onDrawEnd={handleDrawEnd} />
          {!drawMode && value ? (
            <Rectangle
              bounds={[
                [value.north, value.east],
                [value.south, value.west]
              ]}
              pathOptions={{ color: "#2f8fd6", weight: 2, fillOpacity: 0.15 }}
            />
          ) : null}
        </MapContainer>
      </div>

      {value ? (
        <div className="map-area-picker-bounds">
          <label>
            北緯 (north)
            <input onChange={(e) => updateField("north", e.target.value)} step="0.0001" type="number" value={value.north} />
          </label>
          <label>
            南緯 (south)
            <input onChange={(e) => updateField("south", e.target.value)} step="0.0001" type="number" value={value.south} />
          </label>
          <label>
            東經 (east)
            <input onChange={(e) => updateField("east", e.target.value)} step="0.0001" type="number" value={value.east} />
          </label>
          <label>
            西經 (west)
            <input onChange={(e) => updateField("west", e.target.value)} step="0.0001" type="number" value={value.west} />
          </label>
        </div>
      ) : (
        <div className="map-area-picker-empty">尚未框選範圍</div>
      )}
    </div>
  );
}
