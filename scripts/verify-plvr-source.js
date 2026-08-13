/**
 * 高雄房市情報雷達 — 官方資料來源 MVP 驗證腳本
 *
 *   node scripts/verify-plvr-source.js
 *
 * 目的只有一個：證明「內政部實價登錄開放資料下載 → 解析 → 篩選高雄市」這條路走得通。
 * 這支腳本是唯讀的，只會：
 *   1. 從內政部 plvr.land.moi.gov.tw 下載當季（或上一季）不動產買賣批次資料 zip
 *   2. 在記憶體中解壓（不寫暫存檔），列出 zip 內所有檔名
 *   3. 用「內容比對」找出高雄市的買賣資料 CSV（不是用猜的縣市代碼——是解析每個候選
 *      檔案的『鄉鎮市區』欄位，看內容是不是三民區/左營區/鼓山區這類高雄市行政區）
 *   4. 動態比對中文欄位標題（不寫死欄位順序），整理出 20～50 筆樣本
 *   5. 輸出成 JSON 到 scripts/output/plvr-kaohsiung-sample.json，供人工核對
 *
 * 不會寫入 Supabase、不會動 schema.sql、不會碰後台任何程式碼。
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "scripts", "output");
const SAMPLE_SIZE = 40;

// 確認一筆資料是不是高雄市：看『鄉鎮市區』欄位是否命中已知的高雄市行政區名稱。
// 這份清單只是拿來「驗證下載到的檔案內容」，不是拿來篩資料用的規則（跟後台的
// 監控區域規則是兩回事），所以在這裡列出來沒有「寫死判定邏輯」的疑慮。
const KAOHSIUNG_DISTRICTS = [
  "鹽埕區", "鼓山區", "左營區", "楠梓區", "三民區", "新興區", "前金區", "苓雅區",
  "前鎮區", "旗津區", "小港區", "鳳山區", "林園區", "大寮區", "大樹區", "大社區",
  "仁武區", "鳥松區", "岡山區", "橋頭區", "燕巢區", "田寮區", "阿蓮區", "路竹區",
  "湖內區", "茄萣區", "永安區", "彌陀區", "梓官區", "旗山區", "美濃區", "六龜區",
  "甲仙區", "杉林區", "內門區", "茂林區", "桃源區", "那瑪夏區"
];

function log(...args) {
  console.log(...args);
}

function rocSeasonString(date) {
  const rocYear = date.getFullYear() - 1911;
  const season = Math.floor(date.getMonth() / 3) + 1;
  return `${rocYear}S${season}`;
}

function previousSeasonString(seasonStr) {
  const match = seasonStr.match(/^(\d+)S(\d)$/);
  if (!match) throw new Error(`無法解析季別字串：${seasonStr}`);
  let rocYear = Number(match[1]);
  let season = Number(match[2]) - 1;
  if (season < 1) {
    season = 4;
    rocYear -= 1;
  }
  return `${rocYear}S${season}`;
}

function downloadUrl(seasonStr) {
  return `https://plvr.land.moi.gov.tw/DownloadSeason?season=${seasonStr}&type=zip&fileName=lvr_landcsv.zip`;
}

async function fetchZipBuffer(seasonStr) {
  const url = downloadUrl(seasonStr);
  log(`嘗試下載：${url}`);
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketRadarVerifyScript/1.0)" }
  });
  log(`  HTTP ${response.status} ${response.headers.get("content-type") || ""} content-length=${response.headers.get("content-length") || "?"}`);
  if (!response.ok) {
    return { ok: false, status: response.status };
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  // 內政部在查無資料或參數錯誤時，有時仍回 200 但吐一個很小的 HTML/文字錯誤頁，不是真的 zip。
  // zip 檔一定以 PK 開頭（signature 0x04034b50 或空 zip 的 0x06054b50），拿這個當守門判斷。
  const looksLikeZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!looksLikeZip) {
    log(`  下載內容不是有效的 zip（前幾個位元組：${buffer.subarray(0, 16).toString("hex")}），視為這一季查無資料。`);
    return { ok: false, status: response.status, notZip: true };
  }
  return { ok: true, buffer };
}

/**
 * 最小可用的 ZIP 讀取器（只支援 stored / deflate 兩種常見壓縮方式，
 * 內政部這份資料就是用這兩種之一）。不引入額外套件，直接照 ZIP 檔案格式規格解析
 * End of Central Directory → Central Directory entries → Local File Header + 資料本體。
 */
function readZipEntries(buffer) {
  const EOCD_SIG = 0x06054b50;
  const CENTRAL_SIG = 0x02014b50;
  const LOCAL_SIG = 0x04034b50;

  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error("找不到 ZIP 的 End of Central Directory，檔案可能損毀或不是 zip。");

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);

  const entries = [];
  let offset = centralDirOffset;
  for (let i = 0; i < totalEntries; i++) {
    const sig = buffer.readUInt32LE(offset);
    if (sig !== CENTRAL_SIG) throw new Error(`第 ${i} 筆 Central Directory 簽章不符，位移 ${offset}`);
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    entries.push({ fileName, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  function extract(entry) {
    const { localHeaderOffset, compressionMethod, compressedSize } = entry;
    const sig = buffer.readUInt32LE(localHeaderOffset);
    if (sig !== LOCAL_SIG) throw new Error(`Local File Header 簽章不符：${entry.fileName}`);
    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraFieldLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);

    if (compressionMethod === 0) return compressedData;
    if (compressionMethod === 8) return zlib.inflateRawSync(compressedData);
    throw new Error(`不支援的壓縮方式 (${compressionMethod})：${entry.fileName}`);
  }

  return entries.map((entry) => ({ ...entry, extract: () => extract(entry) }));
}

/** 簡易 CSV 解析：處理雙引號包住、逗號分隔，足夠應付內政部這份資料。 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function decodeCsvBuffer(buffer) {
  const utf8 = buffer.toString("utf8");
  const replacementCount = (utf8.match(/�/g) || []).length;
  const looksBroken = replacementCount > 5;
  return { text: utf8, encoding: "utf8", looksBroken, replacementCount };
}

function isLikelyKaohsiungCsv(rows) {
  if (rows.length < 3) return false;
  const header = rows[0];
  const districtColIndex = header.findIndex((h) => h.includes("鄉鎮市區") || h.includes("行政區"));
  if (districtColIndex === -1) return false;
  const sampleRows = rows.slice(2, 12); // 跳過中文表頭 + 英文欄位代碼列
  let hits = 0;
  for (const r of sampleRows) {
    const value = (r[districtColIndex] || "").trim();
    if (KAOHSIUNG_DISTRICTS.some((d) => value.includes(d))) hits++;
  }
  return hits >= Math.min(3, sampleRows.length);
}

function findColumnIndex(header, candidates) {
  for (const candidate of candidates) {
    const idx = header.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

const SQM_PER_PING = 3.30579;

function toNumber(value) {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeRokDate(value) {
  // 內政部日期常見格式：民國年月日連續數字，例如 1130615 = 民國113年6月15日
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{2,3})(\d{2})(\d{2})$/);
  if (!match) return raw || null;
  const [, rocYear, month, day] = match;
  const westernYear = Number(rocYear) + 1911;
  return `${westernYear}-${month}-${day}`;
}

function extractSamples(rows, limit) {
  const header = rows[0];
  const columnIndex = {
    district: findColumnIndex(header, ["鄉鎮市區"]),
    address: findColumnIndex(header, ["土地位置建物門牌", "建物門牌", "土地位置"]),
    transactionDate: findColumnIndex(header, ["交易年月日"]),
    buildingType: findColumnIndex(header, ["建物型態"]),
    floor: findColumnIndex(header, ["移轉層次"]),
    buildingArea: findColumnIndex(header, ["建物移轉總面積"]),
    landArea: findColumnIndex(header, ["土地移轉總面積"]),
    parking: findColumnIndex(header, ["車位類別"]),
    totalPrice: findColumnIndex(header, ["總價元"]),
    unitPrice: findColumnIndex(header, ["單價元"]),
    mainUse: findColumnIndex(header, ["主要用途"])
  };

  log("  欄位比對結果：", columnIndex);

  const dataRows = rows.slice(2); // 第 0 列中文表頭、第 1 列英文欄位代碼、第 2 列起才是資料
  const samples = [];
  for (const r of dataRows) {
    if (samples.length >= limit) break;
    const districtValue = columnIndex.district !== -1 ? (r[columnIndex.district] || "").trim() : "";
    if (!KAOHSIUNG_DISTRICTS.some((d) => districtValue.includes(d))) continue;

    const buildingAreaSqm = columnIndex.buildingArea !== -1 ? toNumber(r[columnIndex.buildingArea]) : null;
    const landAreaSqm = columnIndex.landArea !== -1 ? toNumber(r[columnIndex.landArea]) : null;
    const unitPriceSqm = columnIndex.unitPrice !== -1 ? toNumber(r[columnIndex.unitPrice]) : null;

    const rawRow = {};
    header.forEach((h, i) => {
      rawRow[h || `col_${i}`] = r[i] ?? "";
    });

    samples.push({
      行政區: districtValue,
      地址: columnIndex.address !== -1 ? r[columnIndex.address] : null,
      交易日期: columnIndex.transactionDate !== -1 ? normalizeRokDate(r[columnIndex.transactionDate]) : null,
      建物型態: columnIndex.buildingType !== -1 ? r[columnIndex.buildingType] : null,
      樓層: columnIndex.floor !== -1 ? r[columnIndex.floor] : null,
      建物坪數: buildingAreaSqm !== null ? Number((buildingAreaSqm / SQM_PER_PING).toFixed(2)) : null,
      土地坪數: landAreaSqm !== null ? Number((landAreaSqm / SQM_PER_PING).toFixed(2)) : null,
      車位: columnIndex.parking !== -1 ? r[columnIndex.parking] : null,
      總價: columnIndex.totalPrice !== -1 ? toNumber(r[columnIndex.totalPrice]) : null,
      單價_元每坪: unitPriceSqm !== null ? Math.round(unitPriceSqm * SQM_PER_PING) : null,
      主要用途: columnIndex.mainUse !== -1 ? r[columnIndex.mainUse] : null,
      官方原始資料: rawRow
    });
  }
  return { samples, columnIndex };
}

async function main() {
  log("=== 高雄房市情報雷達：官方資料來源 MVP 驗證 ===\n");

  const now = new Date();
  const currentSeason = rocSeasonString(now);
  const seasonsToTry = [currentSeason, previousSeasonString(currentSeason)];

  let zipResult = null;
  let usedSeason = null;
  for (const season of seasonsToTry) {
    const result = await fetchZipBuffer(season);
    if (result.ok) {
      zipResult = result;
      usedSeason = season;
      break;
    }
  }

  if (!zipResult) {
    log("\n所有嘗試的季別都下載失敗，無法繼續。請確認網路連線，或人工到 https://plvr.land.moi.gov.tw/Index 確認目前可下載的季別代碼。");
    process.exitCode = 1;
    return;
  }

  log(`\n成功下載：season=${usedSeason}，zip 大小 ${(zipResult.buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  const entries = readZipEntries(zipResult.buffer);
  log(`zip 內共有 ${entries.length} 個檔案，前 30 個檔名：`);
  entries.slice(0, 30).forEach((e) => log(`  - ${e.fileName} (${e.uncompressedSize} bytes)`));
  if (entries.length > 30) log(`  ...（其餘 ${entries.length - 30} 個省略）`);

  // 只看「買賣」類的主檔（依內政部命名慣例，買賣主檔通常以 _a.csv 結尾；
  // 但這裡不直接假設，而是逐一嘗試解析、用內容比對找出真正的高雄市買賣資料）。
  const candidateEntries = entries.filter(
    (e) => e.fileName.toLowerCase().endsWith(".csv") && e.fileName.toLowerCase().includes("_a")
  );
  log(`\n篩選出 ${candidateEntries.length} 個「買賣」類 CSV 候選檔案，逐一比對內容是否為高雄市...\n`);

  let matchedFile = null;
  let matchedRows = null;
  let matchedDecodeInfo = null;

  for (const entry of candidateEntries) {
    const buffer = entry.extract();
    const decoded = decodeCsvBuffer(buffer);
    const rows = parseCsv(decoded.text);
    const isKaohsiung = isLikelyKaohsiungCsv(rows);
    log(`  ${entry.fileName}: ${rows.length} 列，編碼=${decoded.encoding}${decoded.looksBroken ? "（可能亂碼，UTF-8 解碼異常字元較多）" : ""} → ${isKaohsiung ? "★ 判定為高雄市" : "不是高雄市"}`);
    if (isKaohsiung && !matchedFile) {
      matchedFile = entry.fileName;
      matchedRows = rows;
      matchedDecodeInfo = decoded;
    }
  }

  if (!matchedFile) {
    log("\n沒有找到任何內容比對成功的高雄市買賣資料檔案。可能原因：欄位命名跟預期不同、或這份 zip 裡的檔案分類方式改變了。");
    log("以下輸出所有候選檔案的表頭，方便人工檢查：");
    for (const entry of candidateEntries) {
      const buffer = entry.extract();
      const decoded = decodeCsvBuffer(buffer);
      const rows = parseCsv(decoded.text);
      log(`  --- ${entry.fileName} ---`);
      log(`  表頭：${JSON.stringify(rows[0] || [])}`);
    }
    process.exitCode = 1;
    return;
  }

  log(`\n★ 確認高雄市買賣資料檔案：${matchedFile}\n`);

  const { samples, columnIndex } = extractSamples(matchedRows, SAMPLE_SIZE);
  log(`共取出 ${samples.length} 筆高雄市樣本資料（目標 20～${SAMPLE_SIZE} 筆）。`);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, "plvr-kaohsiung-sample.json");
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        產生時間: new Date().toISOString(),
        使用季別: usedSeason,
        來源檔名: matchedFile,
        編碼判定: matchedDecodeInfo.encoding,
        編碼疑慮: matchedDecodeInfo.looksBroken,
        欄位比對結果: columnIndex,
        樣本筆數: samples.length,
        樣本資料: samples
      },
      null,
      2
    ),
    "utf8"
  );

  log(`\n已輸出樣本檔案：${path.relative(ROOT, outputPath)}`);
  log("\n請人工檢查這份 JSON 裡的樣本資料是否正確、格式是否可用，確認後再進下一階段。");
}

main().catch((err) => {
  console.error("\n驗證腳本執行失敗：", err);
  process.exitCode = 1;
});
