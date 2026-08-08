-- 在 Supabase 專案的 SQL Editor 貼上整份執行一次即可。
-- 之後要改欄位，直接改這個檔案再重新執行（create/alter 都寫成可重複執行的形式）。

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text not null,
  meet_type text not null,
  intent text[] not null default '{}',
  urgency text,
  note text not null default '',
  slot_iso timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed','completed','cancelled')),
  ai_heat text not null default 'low' check (ai_heat in ('high','mid','low')),
  ai_suggestion text not null default '',
  ai_summary text not null default '',
  ai_next_action text not null default '',
  preview_file text,
  created_at timestamptz not null default now()
);

-- 同一個時段只能有一筆「已預約」狀態的紀錄。
-- 交給資料庫在寫入當下強制擋掉撞號，不能只靠應用程式自己的鎖——
-- Vercel 上同時會有好幾台伺服器在跑，應用程式層的鎖只能保護單一台，
-- 撞號防護一定要落在資料庫這一層才是真的有效。
create unique index if not exists appointments_confirmed_slot_unique
  on appointments (slot_iso)
  where status = 'confirmed';

create index if not exists appointments_created_at_idx on appointments (created_at desc);

-- 開啟列級安全防護，但刻意不建立任何 policy。
-- 這張表只透過伺服器端的 service_role 金鑰存取（會略過 RLS），
-- 一般（anon）金鑰完全讀不到也寫不到，多一層保護，
-- 就算日後不小心把 anon key 用到前端程式碼裡，這張表也不會外洩。
alter table appointments enable row level security;

-- 透過 SQL Editor 直接建表時，Postgres 不會自動把權限授權給 service_role
-- （Supabase 的表格編輯器介面才會自動處理這件事），所以要手動補這一步，
-- 不然 service_role 金鑰雖然能連上資料庫，仍然會被擋在資料表外面。
-- 只授權給 service_role，不給 anon／authenticated，維持前面說的那層保護。
grant usage on schema public to service_role;
grant select, insert, update, delete on public.appointments to service_role;

-- ==========================================================================
-- 首頁瀏覽次數統計（頁尾的「瀏覽人數累積 / 今日造訪人數」）
-- 每次有人載入首頁就新增一筆，累積數＝總筆數，今日數＝今天日期範圍內的筆數。
-- 這只是給訪客看的社會證明小工具，不是關鍵功能，所以沒有做去重複，
-- 同一個人重新整理頁面也會再算一次。
-- ==========================================================================
create table if not exists page_views (
  id bigint generated always as identity primary key,
  viewed_at timestamptz not null default now()
);

create index if not exists page_views_viewed_at_idx on page_views (viewed_at desc);

alter table page_views enable row level security;

grant select, insert on public.page_views to service_role;

-- ==========================================================================
-- 按鈕點擊事件（後台 /admin/stats 的「各按鈕點擊次數」）
-- 一張泛用表，用 event_type 分類是哪個按鈕，時間範圍靠 created_at 篩選。
-- 跟 page_views 一樣，這只是行銷輔助數字，不是關鍵功能，沒有做去重複。
-- ==========================================================================
create table if not exists events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in (
    'book_nav', 'book_hero', 'book_panel', 'book_footer', 'book_fab',
    'line_click', 'tel_click', 'instagram_click', 'facebook_click'
  )),
  created_at timestamptz not null default now()
);

create index if not exists events_created_at_idx on events (created_at desc);
create index if not exists events_type_created_idx on events (event_type, created_at desc);

alter table events enable row level security;

grant select, insert on public.events to service_role;
