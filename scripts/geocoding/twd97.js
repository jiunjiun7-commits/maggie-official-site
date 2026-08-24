/**
 * TWD97 TM2（EPSG:3826，二度分帶）→ WGS84 經緯度座標轉換。
 * 標準 Snyder 橫麥卡托投影反算公式，GRS80 橢球參數。
 * 高雄市政府開放資料「門牌坐標資料」的橫座標／縱座標欄位即為此座標系統。
 */
function twd97ToWgs84(x, y) {
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const b = a * (1 - f);
  const e2 = (a * a - b * b) / (a * a);
  const ep2 = (a * a - b * b) / (b * b);
  const k0 = 0.9999;
  const lon0 = (121 * Math.PI) / 180;
  const FE = 250000;

  const xAdj = x - FE;
  const M = y / k0;
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * Math.pow(e1, 3)) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * Math.pow(e1, 4)) / 32) * Math.sin(4 * mu) +
    ((151 * Math.pow(e1, 3)) / 96) * Math.sin(6 * mu) +
    ((1097 * Math.pow(e1, 4)) / 512) * Math.sin(8 * mu);

  const C1 = ep2 * Math.cos(phi1) * Math.cos(phi1);
  const T1 = Math.tan(phi1) * Math.tan(phi1);
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1));
  const R1 = (a * (1 - e2)) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
  const D = xAdj / (N1 * k0);

  const lat =
    phi1 -
    ((N1 * Math.tan(phi1)) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * Math.pow(D, 4)) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * Math.pow(D, 6)) / 720);

  const lon =
    lon0 +
    (D -
      ((1 + 2 * T1 + C1) * Math.pow(D, 3)) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * Math.pow(D, 5)) / 120) /
      Math.cos(phi1);

  return { lat: (lat * 180) / Math.PI, lng: (lon * 180) / Math.PI };
}

/**
 * WGS84 經緯度 → TWD97 TM2（EPSG:3826）正算，跟 twd97ToWgs84 用同一組橢球／投影參數，
 * 是它的數學反向版本。只用於「拿一個地圖上的座標點，去 KCG 原始 CSV 座標系統裡找最近
 * 的門牌資料」這種反查場景（例如驗證 Polygon 範圍內是否真的有登記門牌），不用在正式
 * 地址解析流程（那個方向永遠是 twd97ToWgs84：CSV 座標→WGS84）。
 */
function wgs84ToTwd97(lat, lng) {
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const b = a * (1 - f);
  const e2 = (a * a - b * b) / (a * a);
  const ep2 = (a * a - b * b) / (b * b);
  const k0 = 0.9999;
  const lon0 = (121 * Math.PI) / 180;
  const FE = 250000;

  const phi = (lat * Math.PI) / 180;
  const lon = (lng * Math.PI) / 180;

  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) * Math.sin(phi));
  const T = Math.tan(phi) * Math.tan(phi);
  const C = ep2 * Math.cos(phi) * Math.cos(phi);
  const A = (lon - lon0) * Math.cos(phi);

  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * Math.pow(e2, 3)) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * Math.pow(e2, 3)) / 1024) * Math.sin(2 * phi) +
      ((15 * e2 * e2) / 256 + (45 * Math.pow(e2, 3)) / 1024) * Math.sin(4 * phi) -
      ((35 * Math.pow(e2, 3)) / 3072) * Math.sin(6 * phi));

  const x =
    FE +
    k0 *
      N *
      (A +
        ((1 - T + C) * Math.pow(A, 3)) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * Math.pow(A, 5)) / 120);

  const y =
    k0 *
    (M +
      N *
        Math.tan(phi) *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4)) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * Math.pow(A, 6)) / 720));

  return { x, y };
}

module.exports = { twd97ToWgs84, wgs84ToTwd97 };
