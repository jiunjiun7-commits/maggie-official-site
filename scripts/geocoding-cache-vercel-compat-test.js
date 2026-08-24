/**
 * Pre-deploy Fix｜KCG Geocode Cache Vercel Compatibility — 回歸測試
 *
 *   node scripts/geocoding-cache-vercel-compat-test.js
 *
 * 只測 scripts/geocoding/kcg-source.js 這次修改的新行為（環境判斷、cache 寫入/fallback），
 * 不重新下載真正的 106MB KCG CSV（那部分下載邏輯本身沒有變動，不是這次修的範圍），
 * 用小型合成 buffer 直接測 writeCsvCacheWithFallback() 的真實檔案系統行為。
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

let pass = 0;
let fail = 0;
function check(label, condition) {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (condition) pass++;
  else fail++;
}

function freshRequire() {
  delete require.cache[require.resolve("./geocoding/kcg-source")];
  return require("./geocoding/kcg-source");
}

async function main() {
  // ---------- 1. Local mode：環境判斷 + 建立/讀取 cache ----------
  delete process.env.VERCEL;
  let kcg = freshRequire();
  check("Local mode：isVercelRuntime() = false", kcg.isVercelRuntime() === false);
  const localPath = kcg.getKcgCachePath();
  check("Local mode：cache path 在 scripts/data/kcg-address-cache 底下", localPath.includes(path.join("scripts", "data", "kcg-address-cache")));

  const testCacheDirLocal = path.join(os.tmpdir(), `kcg-cache-test-local-${process.pid}`);
  fs.rmSync(testCacheDirLocal, { recursive: true, force: true });
  check("Local mode：測試用 cache 目錄一開始不存在", !fs.existsSync(testCacheDirLocal));

  const syntheticBuffer = Buffer.from("header\ntest,row,data\n", "utf8");
  const written1 = kcg.writeCsvCacheWithFallback(syntheticBuffer, testCacheDirLocal);
  check("Local mode：cache 不存在時能建立成功", written1.cacheWriteFailed === false);
  check("Local mode：寫入的檔案內容正確", fs.readFileSync(written1.csvPath, "utf8") === syntheticBuffer.toString("utf8"));

  // 第二次讀（模擬「cache 已存在」分支）：直接用 getCacheCsvPath(dir) 讀，確認可重複讀取。
  const secondReadPath = kcg.getCacheCsvPath(testCacheDirLocal);
  check("Local mode：第二次讀 cache 成功且內容一致", fs.existsSync(secondReadPath) && fs.readFileSync(secondReadPath, "utf8") === syntheticBuffer.toString("utf8"));
  fs.rmSync(testCacheDirLocal, { recursive: true, force: true });

  // ---------- 2. Vercel-like mode：強制 VERCEL=1 ----------
  process.env.VERCEL = "1";
  kcg = freshRequire();
  check("Vercel mode：isVercelRuntime() = true", kcg.isVercelRuntime() === true);
  const vercelPath = kcg.getKcgCachePath();
  check("Vercel mode：cache path 落在 os.tmpdir() 底下", vercelPath.startsWith(os.tmpdir()));
  check("Vercel mode：cache path 不再指向 __dirname/../data", !vercelPath.includes(path.join("scripts", "data")));

  fs.rmSync(vercelPath, { recursive: true, force: true });
  check("Vercel mode：cache 不存在", !fs.existsSync(kcg.getCacheCsvPath(vercelPath)));

  const written2 = kcg.writeCsvCacheWithFallback(syntheticBuffer, vercelPath);
  check("Vercel mode：建立成功", written2.cacheWriteFailed === false);
  check("Vercel mode：第二次可讀取", fs.readFileSync(kcg.getCacheCsvPath(vercelPath), "utf8") === syntheticBuffer.toString("utf8"));
  fs.rmSync(vercelPath, { recursive: true, force: true });

  // ---------- 3. Write failure simulation：強制主要 cache 目錄寫入拋錯 ----------
  const originalMkdirSync = fs.mkdirSync;
  const poisonedDir = path.join(os.tmpdir(), `kcg-cache-test-poisoned-${process.pid}`);
  fs.mkdirSync = function patchedMkdirSync(target, options) {
    if (String(target).includes("kcg-cache-test-poisoned")) {
      throw new Error("SIMULATED_EROFS: read-only file system（測試用，模擬 Vercel 部署目錄唯讀）");
    }
    return originalMkdirSync(target, options);
  };

  let threw = false;
  let result;
  try {
    result = kcg.writeCsvCacheWithFallback(syntheticBuffer, poisonedDir);
  } catch {
    threw = true;
  }
  fs.mkdirSync = originalMkdirSync; // 一定要還原，不管測試結果如何

  check("Write failure：writeCsvCacheWithFallback() 不拋出例外（不讓整個 geocode 掛掉）", threw === false);
  check("Write failure：回傳 cacheWriteFailed=true", result && result.cacheWriteFailed === true);
  check(
    "Write failure：仍然回傳一個可讀取、內容正確的 fallback 檔案（當次已下載資料仍可用）",
    result && fs.existsSync(result.csvPath) && fs.readFileSync(result.csvPath, "utf8") === syntheticBuffer.toString("utf8")
  );
  check("Write failure：fallback 不寫 meta.json（不假裝成真正的持久 cache）", result && result.metaPath === null);

  if (result && result.csvPath) fs.rmSync(path.dirname(result.csvPath), { recursive: true, force: true });
  fs.rmSync(poisonedDir, { recursive: true, force: true });
  delete process.env.VERCEL;

  console.log(`\n${pass} pass, ${fail} fail`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("測試腳本執行失敗：", err);
  process.exitCode = 1;
});
