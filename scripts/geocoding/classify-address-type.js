/**
 * 判斷一筆地址是「一般門牌」還是「地號／段地號」。
 * 地號是地籍座標，不是街道門牌，這階段的解析器完全不處理，只負責正確辨識出來跳過。
 */
function classifyAddressType(address) {
  if (!address) return "unknown";
  if (/地號/.test(address)) return "land_parcel";
  if (/[路街道巷弄]/.test(address) && /號/.test(address)) return "street_address";
  return "unknown";
}

module.exports = { classifyAddressType };
