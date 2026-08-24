/**
 * 高雄市政府資料開放平台「門牌坐標資料－TWD97」讀取模組。
 * 資料集：https://data.kcg.gov.tw/DataSet/Detail/1d7e3a54-6884-4cb0-b07c-c7c9cd411414
 * 免費、免申請帳號、免金鑰，CSV 每月更新。CSV 欄位（無標準表頭名稱，依欄位順序）：
 *   0 省市縣市代碼 / 1 鄉鎮市區代碼 / 2 村里 / 3 鄰 / 4 街路段 / 5 地區
 *   6 巷 / 7 弄 / 8 號 / 9 橫座標(TWD97 X) / 10 縱座標(TWD97 Y)
 *
 * 這支模組純讀取／建索引，不寫入任何資料庫，也不修改來源檔案。
 *
 * Cache filesystem 相容性（Pre-deploy Fix）：
 * Vercel Serverless Function 執行時，部署後的程式碼目錄（__dirname 底下）是唯讀的，
 * 只有 os.tmpdir()（在 Vercel 上就是 /tmp）可以寫入，而且不保證跨 instance／跨部署持續存在。
 * 因此這裡把 cache 明確當成「效能優化」而不是「必要資料來源」：
 *   - cache 路徑依執行環境決定（見 getKcgCachePath()），本機沿用原本行為，Vercel 改用 tmpdir。
 *   - cache 目錄寫入失敗時，改寫進一個保證可寫的獨立 tmpdir 暫存檔（不是「這次跑失敗」，
 *     而是退化成「這次不快取，直接用剛下載的資料跑完」），只印 warning，不拋錯、不影響
 *     geocode_status 判定邏輯本身。
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const { toHalfWidth } = require("./normalize-address");

const DEFAULT_DOWNLOAD_URL =
  "https://data.kcg.gov.tw/File/ResourceDownload/dce0b155-72fb-48ff-8ca0-3ed74f620a3d";

const DEFAULT_MAX_AGE_DAYS = 30; // 資料集本身每月更新一次，30 天內視為新鮮，不重新下載

/**
 * Vercel 官方文件保證：所有 Vercel 執行環境（Production/Preview/Dev，含 Serverless Function
 * runtime 本身）都會自動設定 VERCEL=1，這是判斷「現在是不是跑在 Vercel 上」最穩定的方式，
 * 不需要自己猜測或檢查檔案系統是否可寫。
 */
function isVercelRuntime() {
  return process.env.VERCEL === "1";
}

/**
 * 依執行環境決定 cache 目錄：
 *   - Vercel：os.tmpdir()（等於 /tmp）底下的子目錄，一定可寫，但不保證跨 instance 保留。
 *   - 本機：沿用原本行為（scripts/data/kcg-address-cache），不打亂既有已下載的本機 cache。
 * 純函式，不做任何檔案系統操作，方便測試時單獨呼叫驗證。
 */
function getKcgCachePath() {
  if (isVercelRuntime()) {
    return path.join(os.tmpdir(), "kcg-address-cache");
  }
  return path.join(__dirname, "..", "data", "kcg-address-cache");
}

function getCacheMetaPath(cacheDir = getKcgCachePath()) {
  return path.join(cacheDir, "meta.json");
}

function getCacheCsvPath(cacheDir = getKcgCachePath()) {
  return path.join(cacheDir, "kcg-address.csv");
}

/** 依序嘗試找出可用的 CSV 路徑：環境變數 > 呼叫端指定路徑 > 先前手動下載的暫存檔。 */
function resolveDefaultCsvPath(explicitPath) {
  const candidates = [explicitPath, process.env.KCG_ADDRESS_CSV_PATH, path.join(os.tmpdir(), "kh_address_202508.csv")].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** 下載最新一期 CSV，回傳記憶體中的 buffer（不在這裡寫檔，寫檔與否交給呼叫端決定）。 */
async function downloadLatestCsvBuffer(url = DEFAULT_DOWNLOAD_URL) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`下載失敗：HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** 保留舊名稱相容既有呼叫端（verify-kcg-resolver.js 等）：下載並直接寫入指定路徑。 */
async function downloadLatestCsv(destPath, url = DEFAULT_DOWNLOAD_URL) {
  const buffer = await downloadLatestCsvBuffer(url);
  fs.writeFileSync(destPath, buffer);
  return destPath;
}

function readCacheMeta(metaPath) {
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * 把下載到的 CSV buffer 寫進 cache：先試主要 cache 目錄，失敗（例如唯讀檔案系統）就退化成
 * 寫進一個獨立、保證可寫的 os.tmpdir() 暫存檔，讓「這次」的 geocode 仍然可以正常跑完，
 * 只是不會被下次呼叫的 cache 機制重複使用——這正是「cache 只是效能優化，不是必要資料來源」
 * 這個設計原則的具體實作。兩層都失敗才真的拋錯（理論上不會發生，os.tmpdir() 在所有支援的
 * 執行環境上都應該可寫）。
 */
function writeCsvCacheWithFallback(buffer, cacheDir) {
  const primaryCsvPath = getCacheCsvPath(cacheDir);
  const primaryMetaPath = getCacheMetaPath(cacheDir);
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(primaryCsvPath, buffer);
    return { csvPath: primaryCsvPath, metaPath: primaryMetaPath, cacheWriteFailed: false };
  } catch (err) {
    console.warn(`寫入主要 cache 目錄失敗（${cacheDir}）：${err.message}，改用暫存檔繼續這次 geocode，不重試主要目錄。`);
    const fallbackDir = path.join(os.tmpdir(), `kcg-address-cache-fallback-${process.pid}`);
    fs.mkdirSync(fallbackDir, { recursive: true });
    const fallbackCsvPath = getCacheCsvPath(fallbackDir);
    fs.writeFileSync(fallbackCsvPath, buffer);
    // fallback 模式不寫 meta.json（不建立「快取」語意，下次呼叫仍然會重新下載，避免用一個
    // 沒有持久性保證的暫存檔冒充成真正的 cache）。
    return { csvPath: fallbackCsvPath, metaPath: null, cacheWriteFailed: true };
  }
}

/**
 * 確保有一份可用、夠新鮮的門牌坐標 CSV，需要時才下載，不是每次同步都重抓。
 * 回傳的 source 是寫回 official_transactions.geocode_source 用的來源標記，
 * 帶下載日期，方便日後追查「這筆座標是用哪一版資料解析出來的」。
 *
 * @param {{ maxAgeDays?: number, forceRefresh?: boolean }} [options]
 */
async function ensureCachedCsv({ maxAgeDays = DEFAULT_MAX_AGE_DAYS, forceRefresh = false } = {}) {
  const cacheDir = getKcgCachePath();
  const cacheMetaPath = getCacheMetaPath(cacheDir);
  const cacheCsvPath = getCacheCsvPath(cacheDir);

  const meta = readCacheMeta(cacheMetaPath);
  const cacheFileExists = fs.existsSync(cacheCsvPath);

  if (!forceRefresh && meta && cacheFileExists) {
    const ageMs = Date.now() - new Date(meta.downloadedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays <= maxAgeDays) {
      return { csvPath: cacheCsvPath, source: meta.source, cached: true, ageDays: Number(ageDays.toFixed(1)) };
    }
  }

  try {
    const buffer = await downloadLatestCsvBuffer();
    const downloadedAt = new Date().toISOString();
    const source = `kcg_address_csv@${downloadedAt.slice(0, 10)}`;
    const written = writeCsvCacheWithFallback(buffer, cacheDir);

    if (!written.cacheWriteFailed) {
      fs.writeFileSync(written.metaPath, JSON.stringify({ downloadedAt, source, url: DEFAULT_DOWNLOAD_URL }, null, 2), "utf8");
    }

    return {
      csvPath: written.csvPath,
      source,
      cached: false,
      ageDays: 0,
      cacheWriteFailed: written.cacheWriteFailed,
      warning: written.cacheWriteFailed ? "cache 目錄無法寫入，這次改用暫存檔，下次呼叫會重新下載，不影響本次 geocode 結果。" : undefined
    };
  } catch (err) {
    // 下載失敗但手上還有舊快取／舊暫存檔可用時，寧可用舊資料繼續跑，不要讓整批同步掛掉。
    if (meta && cacheFileExists) {
      console.warn(`下載最新 CSV 失敗（${err.message}），改用舊快取（下載於 ${meta.downloadedAt}）。`);
      return { csvPath: cacheCsvPath, source: meta.source, cached: true, stale: true };
    }
    const fallbackPath = resolveDefaultCsvPath();
    if (fallbackPath) {
      console.warn(`下載最新 CSV 失敗（${err.message}），改用先前手動下載的暫存檔：${fallbackPath}`);
      return { csvPath: fallbackPath, source: "kcg_address_csv@unknown_date", cached: true, stale: true };
    }
    throw err;
  }
}

/**
 * 串流讀取 CSV，只保留 roadNames 指定的路名（避免把 128 萬筆全部載進記憶體），
 * 建成 `路名|巷|弄` → 門牌號 → {x,y} 的索引。
 *
 * @param {string} csvPath
 * @param {Set<string>} roadNames 要保留的路名集合（半形化後的路名）
 */
async function buildAddressIndex(csvPath, roadNames) {
  const index = new Map(); // key: road|lane|alley -> Map(houseNum -> {x,y})
  let scannedLines = 0;

  const rl = readline.createInterface({ input: fs.createReadStream(csvPath, { encoding: "utf8" }) });
  for await (const line of rl) {
    scannedLines++;
    if (scannedLines === 1) continue; // header
    const cols = line.split(",");
    if (cols.length < 11) continue;

    // 資料觀察到的欄位怪癖：當路名本身就是「OO巷」（沒有對應的路／街）時，
    // KCG 資料把路名放在 cols[5]「地區」欄，cols[4]「街路段」留空；
    // 一般路／街則照表頭語意放在 cols[4]，cols[5] 留空。用 cols[4] || cols[5] 涵蓋兩種情況。
    const road = (cols[4] || cols[5] || "").trim();
    if (!road || !roadNames.has(road)) continue;

    const lane = toHalfWidth(cols[6] || "").replace(/巷$/, "");
    const alley = toHalfWidth(cols[7] || "").replace(/弄$/, "");
    // 原始欄位格式是「門牌號」+「號」+ 可選的樓層文字（例：９號十樓、１０之１號），
    // 樓層永遠接在「號」之後，所以取「號」之前的部分就是純門牌號，不能只用 replace(/號$/)
    // （那只在完全沒有樓層資訊時才會命中，含樓層的資料列會整個保留在字串裡導致比對失敗）。
    const houseNum = toHalfWidth(cols[8] || "").split("號")[0].trim();
    if (!houseNum) continue;

    const x = Number(cols[9]);
    const y = Number(cols[10]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const groupKey = `${road}|${lane}|${alley}`;
    if (!index.has(groupKey)) index.set(groupKey, new Map());
    const group = index.get(groupKey);
    if (!group.has(houseNum)) group.set(houseNum, { x, y });
  }

  return { index, scannedLines };
}

module.exports = {
  resolveDefaultCsvPath,
  downloadLatestCsv,
  downloadLatestCsvBuffer,
  buildAddressIndex,
  ensureCachedCsv,
  getKcgCachePath,
  getCacheCsvPath,
  getCacheMetaPath,
  writeCsvCacheWithFallback,
  isVercelRuntime,
  DEFAULT_DOWNLOAD_URL
};
