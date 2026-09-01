import {
  insertExposureCheck,
  listAllTrackableExposureLinks,
  updateExposureLinkCheckResult,
  type ExposureLink,
  type ExposureStatus
} from "@/lib/seller-exposure-store";

type CheckResult = { status: ExposureStatus; views: number | null; errorReason: string };

/**
 * 只驗證「這個網址還在不在」，不讀瀏覽數。官網／5168 用這個函式——平台本身沒有公開瀏覽數，
 * 硬要湊一個數字出來比不顯示更糟。
 *
 * 判定原則（刻意保守）：只有明確拿到 HTTP 404 才算 inactive；拿到 200 系列算 normal；
 * 其他所有狀況——非預期的狀態碼、逾時、DNS 錯誤、fetch 直接丟例外——一律 unverifiable。
 * 「刊登異常」是很重的判斷，只有平台明確告訴我們「這頁不存在」時才能下這個結論，
 * 「這次沒抓成功」跟「明確確認下架」是兩件事，不能混為一談。
 */
export async function checkListingValidity(url: string): Promise<CheckResult> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000)
    });
    if (response.status === 404) {
      return { status: "inactive", views: null, errorReason: "" };
    }
    if (response.ok) {
      return { status: "normal", views: null, errorReason: "" };
    }
    return { status: "unverifiable", views: null, errorReason: `HTTP ${response.status}` };
  } catch (caught) {
    return {
      status: "unverifiable",
      views: null,
      errorReason: caught instanceof Error ? caught.message : "檢查時發生未知錯誤"
    };
  }
}

/**
 * 591 除了驗證有效性，實測頁面上「瀏覽人數」是伺服器端渲染的純文字，可以用正規表達式讀到。
 * 抓不到數字（平台改版、格式跟預期不同）不當成錯誤——頁面還在就是 normal，只是 views 留 null，
 * 一樣走「本週瀏覽數：平台無法自動取得」那條路徑顯示，不會讓整筆檢查變成 unverifiable。
 */
export async function check591(url: string): Promise<CheckResult> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000)
    });
    if (response.status === 404) {
      return { status: "inactive", views: null, errorReason: "" };
    }
    if (!response.ok) {
      return { status: "unverifiable", views: null, errorReason: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const match = html.match(/瀏覽人數[：:]\s*([\d,]+)/);
    const views = match ? Number(match[1].replace(/,/g, "")) : null;
    return { status: "normal", views: Number.isFinite(views) ? views : null, errorReason: "" };
  } catch (caught) {
    return {
      status: "unverifiable",
      views: null,
      errorReason: caught instanceof Error ? caught.message : "檢查時發生未知錯誤"
    };
  }
}

function checkerFor(platform: ExposureLink["platform"]) {
  return platform === "e591" ? check591 : checkListingValidity;
}

export type ExposureCheckSummary = {
  checked: number;
  normal: number;
  inactive: number;
  unverifiable: number;
  errors: { linkId: string; sellerId: string; platform: string; message: string }[];
};

/**
 * 每日排程的主要進入點。單筆連結檢查失敗（例如網路完全打不通、意料外的例外）不影響其他筆繼續跑，
 * 比照 market-radar-orchestration.ts 的錯誤隔離精神——一個案件的曝光連結壞掉，
 * 不該連累其他案件當天的曝光檢查全部沒有結果。
 */
export async function runExposureCheck(): Promise<ExposureCheckSummary> {
  const links = await listAllTrackableExposureLinks();
  const summary: ExposureCheckSummary = { checked: 0, normal: 0, inactive: 0, unverifiable: 0, errors: [] };

  for (const link of links) {
    if (!link.listingUrl) continue; // 理論上 e591/e5168/website 一定有網址（schema 擋過），這裡是防呆

    try {
      const check = checkerFor(link.platform);
      const result = await check(link.listingUrl);

      await insertExposureCheck(link.id, result);
      await updateExposureLinkCheckResult(link.id, result);

      summary.checked += 1;
      summary[result.status] += 1;
    } catch (caught) {
      summary.errors.push({
        linkId: link.id,
        sellerId: link.sellerId,
        platform: link.platform,
        message: caught instanceof Error ? caught.message : "未知錯誤"
      });
    }
  }

  return summary;
}
