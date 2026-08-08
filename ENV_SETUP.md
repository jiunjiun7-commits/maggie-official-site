# 環境變數設定

這份文件分兩部分：**後台 LINE 登入**、**預約資料庫（Supabase）**。兩組互不影響，
但預約資料庫沒設定的話，正式環境的預約會全部走 LINE 備援（見下方說明），無法累積在後台。

本機開發（`npm run dev`）**兩組都不需要**設定，會自動退回本機檔案模式，方便你測試。
正式部署到 Vercel 兩組都**建議設定**：LINE 登入沒設定後台會直接擋住；
Supabase 沒設定，預約表單一律改由 LINE 送出（不會出錯，但後台看不到）。

## 後台 LINE 登入：需要的四個變數

| 變數 | 說明 |
|---|---|
| `LINE_LOGIN_CHANNEL_ID` | LINE Login channel 的 Channel ID |
| `LINE_LOGIN_CHANNEL_SECRET` | 同一個 channel 的 Channel secret |
| `AUTH_SECRET` | 用來簽 session cookie 的亂碼字串 |
| `LINE_ALLOWED_USER_IDS` | 允許進後台的 LINE userId，多個用逗號分隔 |

## 步驟一：建立 LINE Login channel

1. 到 [LINE Developers Console](https://developers.line.biz/console/) 用你的 LINE 帳號登入
2. 建立一個 Provider（名稱隨意，例如「Maggie」）
3. 在 Provider 底下建立 **LINE Login** channel（不是 Messaging API）
4. 進入 **Basic settings**，抄下 `Channel ID` 與 `Channel secret`
5. 進入 **LINE Login settings** → `Callback URL` 填入：

```
https://你的網域/api/auth/line/callback
```

> 部署到 Vercel 後網域會長得像 `xxx.vercel.app`，拿到網址再回來補這一欄。
> 沒填對的話登入會失敗並顯示「向 LINE 換取權杖失敗」。

## 步驟二：產生 AUTH_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

把印出來的那串複製起來。

## 步驟三：在 Vercel 填入變數

Vercel 專案 → **Settings** → **Environment Variables**，逐一新增上面三個
（`LINE_ALLOWED_USER_IDS` 先留空），然後重新部署。

## 步驟四：取得你的 LINE userId

1. 打開 `https://你的網域/admin/appointments`
2. 會被導到登入頁，按「用 LINE 登入」
3. 完成 LINE 授權後，畫面會顯示你的 userId（一串 `U` 開頭的英數字）
4. 把它填進 Vercel 的 `LINE_ALLOWED_USER_IDS`，重新部署

完成後再登入一次就進得去了。之後只有這個 LINE 帳號能看到客戶資料。

## 預約資料庫（Supabase）：需要的兩個變數

| 變數 | 說明 |
|---|---|
| `SUPABASE_URL` | 專案的 API URL，例如 `https://xxxx.supabase.co`，不是機密 |
| `SUPABASE_SERVICE_ROLE_KEY` | 伺服器專用的完整權限金鑰（新版介面叫 Secret key），**絕對不能外流** |

### 設定步驟

1. 到 [supabase.com](https://supabase.com) 建立專案（免費方案即可），Region 選 **Northeast Asia (Tokyo)**
2. 進專案的 **SQL Editor**，貼上 [`supabase/schema.sql`](supabase/schema.sql) 整份內容並執行，建立 `appointments` 資料表
3. 到 **Settings → API Keys**，複製 **Project URL** 與 **Secret key**（`sb_secret_...` 開頭）
4. 在 Vercel 專案 → **Settings → Environment Variables → Production** 新增上面兩個變數
5. 重新部署（Redeploy）

沒設定這兩個變數時，`src/lib/appointment-store.ts` 會自動退回本機檔案模式——
本機開發沒問題，但正式環境（Vercel）的檔案系統是唯讀的，寫入一定會失敗。
`BookingForm.tsx` 已經處理這個狀況：伺服器寫入失敗時會自動改由 LINE 送出預約，
客戶不會看到錯誤畫面，但這筆預約不會出現在後台，需要你自己從 LINE 收單。

### 已經設定過 Supabase，之後又更新了 schema.sql 怎麼辦？

直接把 [`supabase/schema.sql`](supabase/schema.sql) 整份內容重新貼到 SQL Editor 執行一次即可，
裡面每一段都寫成 `create table if not exists` / `if not exists`，已經存在的表格跟資料不會被清掉，
只會補上新的表格（例如頁尾的瀏覽人數統計用的 `page_views`）。不需要重新設定環境變數。

### 安全設計說明

- `SUPABASE_SERVICE_ROLE_KEY` 只在伺服器端使用（API route），程式碼裡用一般環境變數名稱
  （不是 `NEXT_PUBLIC_` 開頭），確保不會被打包進瀏覽器端的程式碼
- `appointments` 資料表開啟了 Row Level Security 但沒有建立任何 policy，
  代表就算金鑰不小心外流到前端，一般權限也讀不到、寫不到這張表
- 同一時段的撞號防護是資料庫層級的唯一索引，不是應用程式自己維護的鎖——
  Vercel 上會有多台伺服器同時運作，防護一定要落在資料庫才真的有效

## 後台登入安全設計說明

- 沒設定環境變數 → 正式環境的後台**完全擋住**（fail closed），不會不小心裸奔
- 白名單是空的 → 任何人都進不去，只會顯示自己的 userId
- session 有效 12 小時，過期要重新登入
- 白名單改動後，舊的 session 會立刻失效
- 保護範圍：`/admin/*` 與 `/api/appointments/*`。客戶的預約流程不受影響
- 這些變數都不會進 Git（`.gitignore` 已排除 `.env` 系列）
