/**
 * Phase 11｜Market Radar 後台共用的顯示格式規則（原本各自寫在 OverviewBoard.tsx 裡，這次
 * 因為情報作戰中心首頁也需要同一套規則，抽成共用函式，避免兩處各寫一份、規則跑掉）。
 *
 * 規則沿用既有已驗證版本，完全沒有改動邏輯：
 * - null 不顯示成 0，顯示 —
 * - 房/廳/衛全部缺值，或官方原始資料三個都是 0（代表不是一般住宅格局，例如車位/整棟商用
 *   交易），都不算「有格局資料」，顯示 —，不顯示 0房0廳0衛
 */

export function formatBuildingArea(value: number | null): string {
  if (value === null) return "—";
  return `${value.toLocaleString("zh-TW")} 坪`;
}

export function formatFloor(input: { floorNumber: number | null; totalFloors: number | null; floorRaw?: string }): string {
  if (input.floorNumber !== null && input.totalFloors !== null) return `${input.floorNumber}/${input.totalFloors}`;
  return input.floorRaw || "—";
}

export function formatLayout(input: { roomCount: number | null; hallCount: number | null; bathCount: number | null }): string {
  const { roomCount, hallCount, bathCount } = input;
  if (roomCount === null || hallCount === null || bathCount === null) return "—";
  if (roomCount === 0 && hallCount === 0 && bathCount === 0) return "—";
  return `${roomCount}房${hallCount}廳${bathCount}衛`;
}
