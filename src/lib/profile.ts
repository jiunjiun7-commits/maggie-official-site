export const PROFILE = {
  name: "林俞君",
  alias: "Maggie",
  title: "永義房屋 經理 · 農十六大千加盟店",
  // 留空就不會顯示標語那一行
  slogan: "",
  phone: "0958-563-377",
  phoneRaw: "0958563377",
  // TODO: 想公開對外信箱再填，留空就不會顯示這一行
  email: "",
  // TODO: 補上門市完整地址（含路名門牌）
  address: "高雄市左營區 · 永義房屋 農十六大千加盟店",
  // 由 scripts/crop-avatar.js 從全身照裁出的頭肩照
  photoUrl: "/card/maggie-avatar.jpg",
  social: {
    line: "https://lin.ee/SIpqpSU",
    instagram: "https://www.instagram.com/mgg_3377",
    // 沒有的就留空字串，按鈕會自動隱藏
    facebook: "https://www.facebook.com/profile.php?id=61589333812360",
    youtube: ""
  }
} as const;

export const BRAND = {
  siteName: "林俞君 Maggie｜高雄房地產顧問",
  shortName: "房地產護理師",
  areas: "高雄市 鼓山區 · 左營區 · 三民區",
  focus: "美術館特區 · 農十六重劃區"
} as const;
