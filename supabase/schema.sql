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

-- ==========================================================================
-- 屋主回報系統（/admin/sellers 後台 + /portal/[token] 屋主前台）
-- 三張表：sellers（委託案件）、seller_reports（每週週報）、
-- seller_access_tokens（屋主專屬連結）。
-- 跟前面幾張表一樣，只透過 service_role 存取，RLS 開啟但不建 policy。
-- ==========================================================================

create table if not exists sellers (
  id uuid primary key default gen_random_uuid(),
  property_name text not null,
  owner_name text not null,
  engagement_start date not null,
  engagement_end date not null,
  asking_price text not null default '',
  address text not null default '',
  internal_note text not null default '',
  status text not null default 'active' check (status in ('active', 'sold', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sellers_status_idx on sellers (status);

alter table sellers enable row level security;

grant select, insert, update, delete on public.sellers to service_role;

-- 每週一筆週報，seller_id + period_start 唯一，避免同一週重複建立。
-- exposure / competitors / next_week_strategy 用 jsonb 打包，
-- 避免曝光平台（8 個以上）各自開一個平面欄位讓表格暴增。
create table if not exists seller_reports (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  report_date date not null,
  period_start date not null,
  period_end date not null,
  exposure jsonb not null default '{}',
  inquiries_week int not null default 0,
  inquiries_total int not null default 0,
  viewings_week int not null default 0,
  viewings_total int not null default 0,
  viewings_pending int not null default 0,
  feedback_text text not null default '',
  market_listings_count int,
  market_new_listings int,
  market_price_cuts int,
  market_sold_count int,
  market_observation_text text not null default '',
  competitors jsonb not null default '[]',
  maggie_notes text not null default '',
  next_week_strategy jsonb not null default '{}',
  weekly_goal text not null default '',
  owner_action_needed text not null default '',
  created_at timestamptz not null default now(),
  unique (seller_id, period_start)
);

create index if not exists seller_reports_seller_date_idx on seller_reports (seller_id, report_date desc);

alter table seller_reports enable row level security;

grant select, insert, update, delete on public.seller_reports to service_role;

-- 屋主專屬連結。只存 token 的雜湊值，明碼只在產生當下顯示給 Maggie 複製一次，
-- 之後查不到明碼——就算這張表外流，也還原不出可用的連結。
create table if not exists seller_access_tokens (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists seller_access_tokens_seller_idx on seller_access_tokens (seller_id);

alter table seller_access_tokens enable row level security;

grant select, insert, update, delete on public.seller_access_tokens to service_role;

-- ==========================================================================
-- Maggie 90 天 IG 10K Growth Lab（/admin/ig-growth 後台）
-- 四張表：ig_challenge（挑戰設定，固定一列）、ig_followers_log（每日粉絲數快照）、
-- ig_reels（Reel 主檔）、ig_reel_snapshots（每支 Reel 在 24H/72H/7D/Final 的數據）。
-- 跟前面幾張表一樣，只透過 service_role 存取，RLS 開啟但不建 policy。
-- ==========================================================================

-- 只會有一列（id 固定為 1），用 check 擋掉多列，用 upsert 更新。
create table if not exists ig_challenge (
  id int primary key default 1,
  account text not null default '@mgg_3377',
  day0_date date not null,
  day0_followers int not null,
  target_followers int not null,
  challenge_days int not null default 90,
  updated_at timestamptz not null default now(),
  constraint ig_challenge_singleton check (id = 1)
);

alter table ig_challenge enable row level security;

grant select, insert, update on public.ig_challenge to service_role;

-- 每天最多一筆，用日期當唯一鍵，同一天重複輸入會覆蓋而不是疊加。
create table if not exists ig_followers_log (
  id uuid primary key default gen_random_uuid(),
  log_date date not null unique,
  followers int not null,
  created_at timestamptz not null default now()
);

create index if not exists ig_followers_log_date_idx on ig_followers_log (log_date desc);

alter table ig_followers_log enable row level security;

grant select, insert, update on public.ig_followers_log to service_role;

-- Reel 主檔：發布前就知道的靜態欄位（任務、系列、Hook⋯）＋事後填的實驗結論／DNA 標記。
-- series 只存文字（不開獨立表），系列彙總靠 group by 這個欄位算，Maggie 打字習慣統一就好。
create table if not exists ig_reels (
  id uuid primary key default gen_random_uuid(),
  published_date date not null,
  title text not null,
  series text not null default '',
  episode text not null default '',
  content_engine text not null check (content_engine in ('discovery', 'follow', 'trust')),
  primary_mission text not null check (primary_mission in ('reach', 'follow', 'trust', 'engagement', 'brand')),
  secondary_mission text check (secondary_mission in ('reach', 'follow', 'trust', 'engagement', 'brand')),
  hook text not null default '',
  cover_text text not null default '',
  caption_cta text not null default '',
  video_length_sec int,
  reel_url text not null default '',
  experiment_hypothesis text not null default '',
  experiment_result text check (experiment_result in ('win', 'neutral', 'lose', 'inconclusive')),
  experiment_what_worked text not null default '',
  experiment_what_failed text not null default '',
  experiment_should_repeat text not null default '',
  experiment_should_change text not null default '',
  mother_reel_type text check (mother_reel_type in ('traffic', 'follow', 'trust', 'share', 'save')),
  dna_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ig_reels_published_date_idx on ig_reels (published_date desc);
create index if not exists ig_reels_content_engine_idx on ig_reels (content_engine);

alter table ig_reels enable row level security;

grant select, insert, update, delete on public.ig_reels to service_role;

-- 一支 Reel 在同一個階段（24H/72H/7D/Final）只有一筆，重複輸入會覆蓋更新。
-- 自然數據跟 Paid 數據放在同一列但欄位分開（paid_* 前綴），方便同時間點比較，
-- 但計算「這支內容本身的自然能力」時一定只挑非 paid_* 欄位，不會混在一起算。
create table if not exists ig_reel_snapshots (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references ig_reels(id) on delete cascade,
  stage text not null check (stage in ('24h', '72h', '7d', 'final')),
  captured_at timestamptz not null default now(),
  views int,
  reach int,
  likes int,
  comments int,
  shares int,
  saves int,
  follows int,
  profile_visits int,
  avg_watch_time_sec numeric,
  non_follower_pct numeric,
  reels_tab_pct numeric,
  explore_pct numeric,
  feed_pct numeric,
  stories_pct numeric,
  is_paid_boost boolean not null default false,
  ad_spend numeric,
  paid_views int,
  paid_reach int,
  paid_profile_visits int,
  paid_followers int,
  created_at timestamptz not null default now(),
  unique (reel_id, stage)
);

create index if not exists ig_reel_snapshots_reel_idx on ig_reel_snapshots (reel_id);

alter table ig_reel_snapshots enable row level security;

grant select, insert, update, delete on public.ig_reel_snapshots to service_role;

-- ==========================================================================
-- Initial Data：第八節「目前已知真實 Benchmark」的三支 Reel，只在第一次執行時
-- 塞進去（用 where not exists 擋重複），之後改資料請直接在 /admin/ig-growth 後台改。
-- ==========================================================================

insert into ig_challenge (id, account, day0_date, day0_followers, target_followers, challenge_days)
select 1, '@mgg_3377', '2026-08-11', 1037, 10000, 90
where not exists (select 1 from ig_challenge where id = 1);

insert into ig_followers_log (log_date, followers)
select '2026-08-11', 1037
where not exists (select 1 from ig_followers_log where log_date = '2026-08-11');

insert into ig_reels (
  published_date, title, series, content_engine, primary_mission, secondary_mission,
  video_length_sec, mother_reel_type, dna_notes
)
select '2026-08-01', '京城鉅誕｜高雄豪宅', 'Maggie 帶你看高雄', 'discovery', 'reach', 'follow',
  103, 'traffic',
  '豪宅／高雄／真人進入空間／窺探／驚奇／生活想像／高分享。下一代實驗：高雄最誇張的浴室？高雄豪宅主臥到底多大？3000萬跟6000萬豪宅差在哪？高雄豪宅最沒必要但最爽的設計？'
where not exists (select 1 from ig_reels where title = '京城鉅誕｜高雄豪宅');

insert into ig_reel_snapshots (
  reel_id, stage, views, reach, likes, comments, shares, saves, follows,
  avg_watch_time_sec, non_follower_pct, reels_tab_pct, explore_pct, stories_pct
)
select id, 'final', 14066, 10475, 250, 99, 210, 51, 23, 30, 97.8, 81.5, 12.0, 3.6
from ig_reels where title = '京城鉅誕｜高雄豪宅'
and not exists (
  select 1 from ig_reel_snapshots s where s.reel_id = ig_reels.id and s.stage = 'final'
);

insert into ig_reels (
  published_date, title, series, content_engine, primary_mission, secondary_mission,
  mother_reel_type, dna_notes
)
select '2026-08-05', '房仲沒有崩潰｜被嫌棄的仲介', '房仲沒有崩潰', 'follow', 'follow', 'brand',
  'follow',
  '真實事件／人物衝突／房仲職業情境／情緒／故事／Maggie本人／觀眾想知道後續。105 Followers 是漲粉母片，不能只當高觀看影片看。'
where not exists (select 1 from ig_reels where title = '房仲沒有崩潰｜被嫌棄的仲介');

insert into ig_reel_snapshots (
  reel_id, stage, views, reach, likes, comments, shares, saves, follows,
  is_paid_boost, ad_spend, paid_views, paid_reach, paid_profile_visits, paid_followers
)
select id, 'final', 27723, 20579, 174, 18, 15, 51, 105,
  true, 2267, 23003, 18564, 1442, 61
from ig_reels where title = '房仲沒有崩潰｜被嫌棄的仲介'
and not exists (
  select 1 from ig_reel_snapshots s where s.reel_id = ig_reels.id and s.stage = 'final'
);

insert into ig_reels (
  published_date, title, series, content_engine, primary_mission, secondary_mission,
  video_length_sec, dna_notes
)
select '2026-08-12', '陪客人找家｜終於找到了', '陪客人找家', 'trust', 'trust', 'brand',
  94,
  'Existing Audience Trust Content。Likes Rate不錯但Shares/Saves/Follows/Explore低，陌生擴散能力弱。保留系列但不要連續發太多支，下一支切到 Discovery 或 Follow。'
where not exists (select 1 from ig_reels where title = '陪客人找家｜終於找到了');

insert into ig_reel_snapshots (
  reel_id, stage, views, reach, likes, comments, shares, saves, follows,
  avg_watch_time_sec, reels_tab_pct, feed_pct, explore_pct, stories_pct
)
select id, '24h', 1452, 1086, 40, 2, 1, 1, 0,
  21, 51.2, 37.7, 6.3, 3.1
from ig_reels where title = '陪客人找家｜終於找到了'
and not exists (
  select 1 from ig_reel_snapshots s where s.reel_id = ig_reels.id and s.stage = '24h'
);

-- ==========================================================================
-- 高雄房市情報雷達系統
-- 整合內政部實價登錄公開資料 + 公司內部未登錄成交情報，依自訂監控區域
-- 每日比對新增交易並透過 LINE 推播摘要。詳見專案內規劃文件。
-- ==========================================================================

-- 監控區域：後台可自行新增／停用，不寫死在程式碼裡
create table if not exists market_radar_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text not null default '',
  is_active boolean not null default true,
  sort_order int not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_radar_areas_active_idx on market_radar_areas (is_active, sort_order);

-- 區域判定規則：一個區域可有多條規則，任一命中即算該區域。
-- rule_type='bbox' 時用經緯度矩形（地圖框選出來的範圍），其餘類型用文字比對 rule_value。
create table if not exists market_radar_area_rules (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references market_radar_areas(id) on delete cascade,
  rule_type text not null check (rule_type in ('road','district','section','community','address_keyword','bbox')),
  rule_value text not null default '',
  bbox jsonb,
  created_at timestamptz not null default now()
);

create index if not exists market_radar_area_rules_area_idx on market_radar_area_rules (area_id);

-- 產品分類：可透過 product_category_rules 調整比對規則，不完全硬編碼
create table if not exists product_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table if not exists product_category_rules (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references product_categories(id) on delete cascade,
  source_building_type text not null
);

-- 社區資料庫
create table if not exists communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area_id uuid references market_radar_areas(id) on delete set null,
  district text not null default '',
  address_keyword text not null default '',
  lat numeric,
  lng numeric,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists communities_area_idx on communities (area_id);

-- 官方實價登錄資料：保留官方原始欄位（raw_data）＋整理後可查詢欄位
create table if not exists official_transactions (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'moi_plvr',
  source_season text not null default '',
  source_unique_key text not null,
  transaction_date date,
  fetched_at timestamptz not null default now(),
  district text not null default '',
  address text not null default '',
  lat numeric,
  lng numeric,
  community_id uuid references communities(id) on delete set null,
  building_type_raw text not null default '',
  category_id uuid references product_categories(id) on delete set null,
  floor_raw text not null default '',
  building_area_ping numeric,
  land_area_ping numeric,
  parking_raw text not null default '',
  total_price numeric,
  unit_price numeric,
  building_age_raw text not null default '',
  main_use text not null default '',
  note text not null default '',
  area_id uuid references market_radar_areas(id) on delete set null,
  raw_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (source, source_unique_key)
);

create index if not exists official_transactions_area_idx on official_transactions (area_id);
create index if not exists official_transactions_txn_date_idx on official_transactions (transaction_date);

-- 公司內部成交情報：尚未出現在官方實價登錄，來源固定標記為「公司成交情報／未登錄」
create table if not exists internal_deals (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'internal',
  transaction_date date,
  district text not null default '',
  address text not null default '',
  community_id uuid references communities(id) on delete set null,
  category_id uuid references product_categories(id) on delete set null,
  building_area_ping numeric,
  land_area_ping numeric,
  total_price numeric,
  unit_price numeric,
  note text not null default '',
  area_id uuid references market_radar_areas(id) on delete set null,
  match_status text not null default 'unmatched' check (match_status in ('unmatched', 'candidate', 'matched')),
  matched_official_id uuid references official_transactions(id) on delete set null,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists internal_deals_match_status_idx on internal_deals (match_status);
create index if not exists internal_deals_area_idx on internal_deals (area_id);

-- 每日同步執行紀錄：「沒有新資料」是正常完成，「抓取失敗」才算 failed
create table if not exists radar_sync_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (run_type in ('scheduled', 'manual')),
  status text not null check (status in ('success', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  new_transactions_count int not null default 0,
  error_message text,
  detail jsonb not null default '{}'
);

create index if not exists radar_sync_runs_started_idx on radar_sync_runs (started_at desc);

-- LINE 通知紀錄
create table if not exists line_notification_log (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid references radar_sync_runs(id) on delete set null,
  sent_at timestamptz not null default now(),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  summary_text text not null default '',
  error_message text
);

alter table market_radar_areas enable row level security;
alter table market_radar_area_rules enable row level security;
alter table product_categories enable row level security;
alter table product_category_rules enable row level security;
alter table communities enable row level security;
alter table official_transactions enable row level security;
alter table internal_deals enable row level security;
alter table radar_sync_runs enable row level security;
alter table line_notification_log enable row level security;

grant select, insert, update, delete on public.market_radar_areas to service_role;
grant select, insert, update, delete on public.market_radar_area_rules to service_role;
grant select, insert, update, delete on public.product_categories to service_role;
grant select, insert, update, delete on public.product_category_rules to service_role;
grant select, insert, update, delete on public.communities to service_role;
grant select, insert, update, delete on public.official_transactions to service_role;
grant select, insert, update, delete on public.internal_deals to service_role;
grant select, insert, update, delete on public.radar_sync_runs to service_role;
grant select, insert, update, delete on public.line_notification_log to service_role;

-- 第一階段預設監控區域（可在後台停用／修改，這裡只是給個起點）
insert into market_radar_areas (name, district, sort_order)
select '農十六', '左營區', 1
where not exists (select 1 from market_radar_areas where name = '農十六');

insert into market_radar_areas (name, district, sort_order)
select '美術館', '鼓山區', 2
where not exists (select 1 from market_radar_areas where name = '美術館');

insert into market_radar_areas (name, district, sort_order)
select '中都重劃區', '三民區', 3
where not exists (select 1 from market_radar_areas where name = '中都重劃區');

insert into market_radar_areas (name, district, sort_order)
select '瑞豐巨蛋商圈', '左營區', 4
where not exists (select 1 from market_radar_areas where name = '瑞豐巨蛋商圈');

insert into market_radar_areas (name, district, sort_order)
select '高醫商圈', '三民區', 5
where not exists (select 1 from market_radar_areas where name = '高醫商圈');

-- 預設產品分類
insert into product_categories (key, label, sort_order)
select 'residential_tower', '住宅大樓／華廈', 1
where not exists (select 1 from product_categories where key = 'residential_tower');

insert into product_categories (key, label, sort_order)
select 'apartment', '公寓', 2
where not exists (select 1 from product_categories where key = 'apartment');

insert into product_categories (key, label, sort_order)
select 'townhouse', '透天', 3
where not exists (select 1 from product_categories where key = 'townhouse');

insert into product_categories (key, label, sort_order)
select 'storefront', '店面／商業不動產', 4
where not exists (select 1 from product_categories where key = 'storefront');

insert into product_categories (key, label, sort_order)
select 'office', '辦公', 5
where not exists (select 1 from product_categories where key = 'office');

insert into product_categories (key, label, sort_order)
select 'land', '土地', 6
where not exists (select 1 from product_categories where key = 'land');

insert into product_categories (key, label, sort_order)
select 'factory', '廠房', 7
where not exists (select 1 from product_categories where key = 'factory');

insert into product_categories (key, label, sort_order)
select 'other', '其他', 8
where not exists (select 1 from product_categories where key = 'other');
