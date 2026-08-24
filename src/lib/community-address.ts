/**
 * 社區自動辨識 — 地址正規化／拆解。
 *
 * 目的：把「高雄市鼓山區龍德路３８５號九樓」這種完整地址，拆成
 * 「行政區＋路名＋門牌號」當作「同一棟」的比對 key（去掉樓層／之N），
 * 不比對完整地址字串（同一棟不同樓層的地址字串本來就不會完全一樣）。
 *
 * 刻意保守：解析不出乾淨的「路名＋門牌號＋號」格式時回傳 null，不猜測——
 * 呼叫端看到 null 就歸類成「無法判斷」，交給人工看，不要硬套錯誤的分組。
 */

const FULLWIDTH_DIGIT_OFFSET = 0xff10 - 0x30; // '０'(0xFF10) 對應 '0'(0x30)

function toHalfWidthDigits(text: string): string {
  return text.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - FULLWIDTH_DIGIT_OFFSET));
}

export type CommunityAddressKey = {
  district: string;
  road: string;
  houseNumber: string;
  suffix: string; // 門牌號之後的部分（樓層、之N、共有部分等），僅供顯示參考，不參與比對 key
};

/**
 * district 直接用 official_transactions.district（已經是正規化過的行政區，不用再從字串猜）。
 * address 預期格式：「高雄市{district}{路名}{門牌號}號{其餘部分}」。
 */
export function parseCommunityAddressKey(district: string, address: string): CommunityAddressKey | null {
  if (!district || !address) return null;

  const normalized = toHalfWidthDigits(address.trim());

  // 去掉開頭的「高雄市」與行政區名稱（如果有的話），只保留路名之後的部分。
  let rest = normalized;
  const cityPrefixMatch = rest.match(/^(高雄市)?/);
  if (cityPrefixMatch) rest = rest.slice(cityPrefixMatch[0].length);
  if (rest.startsWith(district)) rest = rest.slice(district.length);

  // 路名＋門牌號＋「號」＋其餘部分。路名本身可能含中文數字（例如「明誠三路」），
  // 這裡只找「阿拉伯數字＋號」這個明確的分界點，不會跟路名裡的中文數字混淆。
  const match = rest.match(/^(.+?)(\d+)號(.*)$/);
  if (!match) return null;

  const [, roadRaw, houseNumber, suffixRaw] = match;
  const road = roadRaw.trim();
  if (!road || !houseNumber) return null;

  return { district, road, houseNumber, suffix: suffixRaw.trim() };
}

/** 同一棟的比對 key（門牌層級，不含樓層）。 */
export function communityAddressKeyId(key: CommunityAddressKey): string {
  return `${key.district}|${key.road}|${key.houseNumber}`;
}

const DASH_CHARS = /[‐‑‒–—−－]/g; // 各種連字號/破折號/全形減號，統一成半形 "-"

/**
 * 把 Seed Data（PDF 逐戶清單）裡的原始門牌字串，正規化成跟
 * parseCommunityAddressKey() 解析官方交易地址時產生的 houseNumber 完全同一種格式
 * （純數字，不含「號」字、不含「之N」「-N」子門牌後綴——因為官方交易地址解析時，
 * 這些後綴本來就被丟進 suffix、不參與比對 key，所以「385號」「385號之1」「385號-1」
 * 這種同一棟不同戶的地址，官方那邊解析出來的 houseNumber 全部都只會是「385」）。
 *
 * 這代表 canonical 化之後，同一棟樓底下的子門牌（385/385-1/385-2...）會收斂成同一個
 * canonical house number——這是刻意的，因為比對的目的是「這是不是同一棟」，不是要在
 * community_addresses 裡分辨戶別。呼叫端如果需要知道被收斂掉哪些原始門牌，要另外自己統計
 * （這支函式只回傳 canonical 值本身）。
 *
 * 明確排除「範圍摘要」（例如「130-140號」，dash 出現在數字和「號」之間），這種輸入代表
 * 呼叫端誤把一段範圍摘要文字當成單一門牌傳進來，回傳 null，不猜測要展開成哪幾個號碼。
 *
 * 無法安全辨識的輸入一律回傳 null，不猜。
 */
export function canonicalizeHouseNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let text = raw.trim();
  if (!text) return null;

  // 全形數字轉半形（跟 parseCommunityAddressKey 用同一套規則）。
  text = text.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - FULLWIDTH_DIGIT_OFFSET));
  // 各種連字號統一成半形 "-"，方便後面用同一個 pattern 判斷。
  text = text.replace(DASH_CHARS, "-");
  // 全形「號」「之」也順手轉半形空白處理不需要，中文字本身沒有全半形問題，這裡不用轉。
  text = text.replace(/\s+/g, "");

  // 明確的「範圍摘要」樣式：數字-數字號（dash 出現在「號」字之前，代表兩個不同的門牌基底數字）。
  // 例如「130-140號」「180－196號」。這種不是單一門牌，回傳 null，不猜測要展開成哪些號碼。
  if (/^\d+-\d+號/.test(text)) return null;

  // 正常樣式：數字＋「號」＋（可省略）子門牌後綴（-N 或 之N）。
  const match = text.match(/^(\d+)號(?:[-之]\d+)?$/);
  if (!match) return null;

  return match[1];
}

/**
 * 明確非社區型產品，才回傳 true——只認絕對不會有「社區」概念的型態（透天厝＝單一戶獨棟）。
 * 「其他」「公寓」「華廈」都刻意不算，因為這些仍然可能是有社區/大樓名稱的多戶建物，
 * 不確定就交給地址分組走 needs_confirmation，不要用建物型態猜測。
 */
const CLEARLY_NON_COMMUNITY_TYPES = ["透天厝"];

export function isClearlyNonCommunityType(buildingTypeRaw: string | null | undefined): boolean {
  const text = (buildingTypeRaw ?? "").trim();
  if (!text) return false;
  return CLEARLY_NON_COMMUNITY_TYPES.some((t) => text.includes(t));
}
