# 林俞君 Maggie｜高雄房地產顧問官網

高雄房仲林俞君（Maggie）的個人官網與線上預約系統。
以 Next.js 打造，包含形象官網、電子名片、客戶線上預約與預約管理後台。

## 頁面

| 路徑 | 說明 | 需要登入 |
|---|---|---|
| `/` | 官網首頁：形象、服務區域、戰績、服務項目、預約入口 | 否 |
| `/card` | 電子名片，適合放在 LINE 或 IG 個人簡介 | 否 |
| `/card/booking` | 客戶線上預約：選時段、選方式、填需求 | 否 |
| `/admin/appointments` | 預約管理後台：客戶溫度、追蹤建議、狀態更新 | **是（LINE 登入）** |

## 功能

- 響應式官網，套用永義房屋 CIS 色票
- SEO：結構化資料（RealEstateAgent）、Open Graph、地區訊號
- 線上預約：平日 10:00–18:00、可預約兩週內、**同時段撞號防護**
- 客戶溫度自動判定（高／中／低）與追蹤建議
- 預約確認信 HTML 預覽（本機產生，不會真的寄出）
- 後台以 LINE Login 保護，僅限白名單帳號

## 本機執行

需要 Node.js 20.9 以上。

```bash
npm ci
npm run check
npm run build
npm run dev
```

開啟 http://localhost:3000

本機開發模式下後台可直接開啟，方便測試。

## 部署

推薦 Vercel（免費方案即可）。部署前**務必**先設定環境變數，
否則正式站的後台會整個擋住 —— 這是刻意的保護，避免客戶個資外流。

設定步驟見 [ENV_SETUP.md](ENV_SETUP.md)。

## 修改自己的資料

| 要改什麼 | 改哪裡 |
|---|---|
| 姓名、電話、地址、社群連結 | `src/lib/profile.ts` |
| 營業時間、開放天數、需求選項、見面方式 | `src/lib/booking.ts` |
| 客戶溫度判定邏輯、區域關鍵字 | `src/lib/grading.ts` |
| 官網文案與區塊 | `src/app/page.tsx` |
| 官網樣式（CIS 色票在最上面） | `src/app/site.css` |
| 名片與後台樣式 | `src/app/globals.css` |
| 照片 | `public/site/img/`、`public/card/` |

## 資料存放

課堂版使用本機 JSON：

- 示範資料：`data/appointments.seed.json`
- 執行後資料：`data/appointments.json`（不進 Git）
- 信件預覽：`data/outbox/`（不進 Git）

> **正式營運前請注意**：本機 JSON 不適合長期存放真實客戶個資。
> 部署到 Vercel 後檔案系統是暫時性的，重新部署資料就會消失。
> 要長期使用請改接資料庫（例如 Vercel Postgres 或 Supabase），
> 並補上資料保留期限與刪除機制。

## 授權說明

本專案改寫自「房仲 AI 預約系統」教學專案（熊課／謝濱展），
個人資料、文案、視覺與後台身分驗證為自行調整與新增的部分。
原始教學程式碼著作權屬原作者所有。
