import type { Metadata } from "next";
import "./globals.css";

// TODO: 綁定正式網域後改成你的網址
const SITE_URL = "https://example.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "林俞君 Maggie｜高雄房仲 鼓山‧左營‧三民｜美術館 農十六 專任經紀人",
    template: "%s｜林俞君 Maggie"
  },
  description:
    "高雄房仲林俞君 Maggie，永義房屋經理，專營美術館特區與農十六，服務鼓山區、左營區、三民區。112 年度 TOP1、年度最佳服務楷模。提供高級住宅、資產配置、稅務諮詢與市場行情分析，可線上預約一對一諮詢。LINE：maggie3377。",
  keywords: [
    "高雄房仲", "鼓山區房仲", "左營區房仲", "三民區房仲",
    "美術館特區", "農十六", "高雄豪宅", "高雄買房", "高雄賣房",
    "資產配置", "房地產稅務諮詢", "高雄房價行情", "實價登錄查詢",
    "林俞君", "永義房屋"
  ],
  authors: [{ name: "林俞君 Maggie" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "profile",
    locale: "zh_TW",
    siteName: "林俞君 Maggie｜高雄房地產顧問",
    title: "林俞君 Maggie｜高雄房仲 鼓山‧左營‧三民｜美術館 農十六",
    description: "112 年度 TOP1、年度最佳服務楷模。專營美術館特區與農十六，可線上預約諮詢。",
    url: "/",
    images: [{ url: "/card/maggie.jpg", alt: "高雄房仲林俞君 Maggie 形象照" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "林俞君 Maggie｜高雄房仲 鼓山‧左營‧三民",
    description: "專營美術館特區與農十六。高級住宅、資產配置、稅務諮詢、行情分析。",
    images: ["/card/maggie.jpg"]
  },
  robots: { index: true, follow: true },
  other: {
    "geo.region": "TW-KHH",
    "geo.placename": "高雄市鼓山區"
  }
};

export const viewport = { themeColor: "#D4587A" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-TW">
      <body>{children}</body>
    </html>
  );
}
