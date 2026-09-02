import Topbar from "@/app/_components/Topbar";
import { allowedUserIds, isDevBypass, readLineConfig } from "@/lib/auth";
import "./login.css";

export const dynamic = "force-dynamic";

export const metadata = { title: "後台登入", robots: { index: false, follow: false } };

const MESSAGES: Record<string, string> = {
  unconfigured: "還沒設定 LINE Login。請先在 LINE Developers 建立 Login channel，並填好環境變數。",
  no_code: "沒有收到 LINE 回傳的授權碼，請重新登入一次。",
  bad_state: "登入驗證沒有對上，這在用 LINE App 內建瀏覽器開啟時偶爾會發生，屬於正常現象。請直接再按一次「用 LINE 登入」即可。",
  token_failed: "向 LINE 換取權杖失敗。請確認 Channel ID 與 Channel Secret 是否正確。",
  profile_failed: "無法取得 LINE 個人資料，請重新登入。",
  not_allowed: "這個 LINE 帳號不在允許名單內，無法進入後台。",
  demo_wrong_password: "密碼不對，請再試一次。"
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";
  const uid = typeof params.uid === "string" ? params.uid : "";
  const displayName = typeof params.name === "string" ? params.name : "";

  const configured = Boolean(readLineConfig());
  const hasAllowlist = allowedUserIds().length > 0;
  // Demo/Beta 部署專用：有設定這組共用密碼時，整頁改用密碼登入，不顯示 LINE 登入區塊。
  // 正式站台完全沒有這個環境變數，isDemoMode 永遠是 false，畫面跟原本一模一樣。
  const isDemoMode = Boolean(process.env.DEMO_SHARED_PASSWORD);

  return (
    <div className="site-shell">
      <Topbar admin />
      <main className="card-page">
        <article className="business-card" style={{ paddingBottom: 28 }}>
          <div className="card-cover">{isDemoMode ? "屋主回報系統 · Demo 後台" : "預約管理 · 後台登入"}</div>
          <div className="card-copy" style={{ paddingTop: 28 }}>
            <h1 style={{ fontSize: 26 }}>{isDemoMode ? "測試版後台" : "只有本人進得來"}</h1>
            <p className="card-slogan">
              {isDemoMode
                ? "輸入 Maggie 提供的測試密碼即可進入，這裡的資料跟正式系統完全分開，儘管試用。"
                : "後台會顯示客戶的姓名與聯絡方式，所以需要用 LINE 驗證身分。"}
            </p>
          </div>

          {isDemoMode ? (
            <>
              {error ? (
                <div className="login-note login-note--err">{MESSAGES[error] || "登入失敗，請再試一次。"}</div>
              ) : null}
              <form action="/api/auth/demo-login" method="post">
                <div className="card-actions" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                  <input
                    autoFocus
                    className="login-uid"
                    name="password"
                    placeholder="測試密碼"
                    required
                    style={{ width: "100%", textAlign: "center" }}
                    type="password"
                  />
                  <button className="button line-button" type="submit">進入 Demo 後台</button>
                </div>
              </form>
            </>
          ) : (
            <>
              {error === "bootstrap" ? (
                <div className="login-note login-note--ok">
                  <b>登入成功，還差最後一步。</b>
                  <p>
                    你的 LINE userId 是{displayName ? `（${displayName}）` : ""}：
                  </p>
                  <code className="login-uid">{uid}</code>
                  <p>
                    把它填進環境變數 <code>LINE_ALLOWED_USER_IDS</code>，重新部署後就能進後台。
                    這一步是為了確保只有你本人能看到客戶資料。
                  </p>
                </div>
              ) : null}

              {error && error !== "bootstrap" ? (
                <div className="login-note login-note--err">{MESSAGES[error] || "登入失敗，請再試一次。"}</div>
              ) : null}

              {!configured ? (
                <div className="login-note login-note--err">
                  <b>尚未設定 LINE Login。</b>
                  <p>需要三個環境變數：<code>LINE_LOGIN_CHANNEL_ID</code>、<code>LINE_LOGIN_CHANNEL_SECRET</code>、<code>AUTH_SECRET</code>。設定方式看 README。</p>
                </div>
              ) : null}

              {configured && !hasAllowlist && error !== "bootstrap" ? (
                <div className="login-note">
                  尚未設定允許名單。第一次用 LINE 登入後，畫面會顯示你的 userId。
                </div>
              ) : null}

              <div className="card-actions">
                <a className="button line-button" href="/api/auth/line/start">用 LINE 登入</a>
              </div>

              {isDevBypass() ? (
                <div className="login-note">
                  目前是開發模式，本機可直接開啟後台不需登入。正式環境一律需要 LINE 登入。
                </div>
              ) : null}
            </>
          )}
        </article>
      </main>
    </div>
  );
}
