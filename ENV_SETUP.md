# 環境變數設定（後台 LINE 登入）

本機開發（`npm run dev`）**不需要**設定，後台會直接開，方便你測試。
正式部署到 Vercel **一定要**設定，否則後台會整個擋住 —— 這是刻意的，避免客戶個資裸奔。

## 需要的四個變數

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

## 安全設計說明

- 沒設定環境變數 → 正式環境的後台**完全擋住**（fail closed），不會不小心裸奔
- 白名單是空的 → 任何人都進不去，只會顯示自己的 userId
- session 有效 12 小時，過期要重新登入
- 白名單改動後，舊的 session 會立刻失效
- 保護範圍：`/admin/*` 與 `/api/appointments/*`。客戶的預約流程不受影響
- 這些變數都不會進 Git（`.gitignore` 已排除 `.env` 系列）
