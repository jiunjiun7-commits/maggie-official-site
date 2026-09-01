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
  community_name text not null,
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

-- 前一版把欄位取名 property_name，後來改叫 community_name（跟後台程式碼一致）。
-- 這段只在舊欄位還在、新欄位還沒建的情況下才會動作，重複執行是安全的。
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'sellers' and column_name = 'property_name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'sellers' and column_name = 'community_name'
  ) then
    alter table sellers rename column property_name to community_name;
  end if;
end $$;

alter table sellers add column if not exists district text not null default '';
alter table sellers add column if not exists listing_title text not null default '';

create index if not exists sellers_status_idx on sellers (status);
create index if not exists sellers_district_idx on sellers (district);

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

-- 精確發布時間（用來算 24H/72H/7D 提醒節點），跟 published_date 分開存：
-- published_date 只到「日」，給列表排序/顯示用；published_at 到「分」，給提醒邏輯算時間點用。
-- 舊資料（一開始用 Initial Data 塞進去的那三支）沒有真實發布時間，寧可讓 published_at
-- 留空、precision 標成 unknown，也不要瞎猜一個時間（例如當天 09:00）填進去——
-- 假資料會污染未來「發布時間對成效影響」的分析，比留空更糟。
-- 提醒邏輯只認 precision = 'exact' 的 Reel，其他一律不產生提醒。
alter table ig_reels add column if not exists published_at timestamptz;
alter table ig_reels add column if not exists published_at_precision text not null default 'unknown'
  check (published_at_precision in ('exact', 'estimated', 'unknown'));

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
select '農十六', '鼓山區', 1
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

-- ==========================================================================
-- 階段五：成交行情分類 ＋ 公司內部成交情報
-- 分類邏輯：物件用途 + 物件型態 兩個欄位組合查表才能得到成交行情分類，
-- 不是只看官方「建物型態」。查不到／衝突／資料不全一律 needs_review=true，不猜測。
-- ==========================================================================

-- 舊的 8 分類目前完全沒有任何 official_transactions / internal_deals 列引用
-- （category_id 全部是 null），可以安全清空重 seed 成使用者提供的 12 分類。
-- product_category_rules 也一併清空重建，因為舊規則只有單欄位（建物型態），
-- 這次改成雙欄位（物件用途＋物件型態）比對，新舊規則語意不同，不適合保留舊資料。
delete from product_category_rules;
delete from product_categories;

insert into product_categories (key, label, sort_order) values
  ('large_building', '大樓/華廈', 1),
  ('apartment', '公寓', 2),
  ('suite', '套房', 3),
  ('townhouse_villa', '透天/別墅', 4),
  ('storefront', '店面', 5),
  ('office', '辦公', 6),
  ('factory', '工廠', 7),
  ('factory_office', '廠辦', 8),
  ('land', '土地', 9),
  ('parking', '車位', 10),
  ('other', '其他(含倉庫/農舍)', 11),
  ('presale', '預售屋', 12);

-- product_category_rules 改成雙欄位比對規則：
--   main_use_pattern / source_building_type 皆為 ''（空字串）代表「萬用」，比對任何值。
--   category_id 允許 null：needs_review=true 的規則列，代表「這個組合本來就查不到，不用猜」
--   （對應使用者提供圖片裡標示「提示，不可查」的格子）。
alter table product_category_rules alter column category_id drop not null;
alter table product_category_rules alter column source_building_type set default '';
alter table product_category_rules add column if not exists main_use_pattern text not null default '';
alter table product_category_rules add column if not exists needs_review boolean not null default false;

create index if not exists product_category_rules_lookup_idx
  on product_category_rules (main_use_pattern, source_building_type);

-- 種子規則資料：完整依使用者提供的「物件用途 × 物件型態 → 成交行情分類」對照圖片轉譯。
-- 物件用途＝店面／辦公／車位／土地／倉庫／其他 這幾類在圖片裡不分物件型態，
-- 用 source_building_type='' 萬用比對整個用途底下的任何型態。

-- 物件用途＝住宅
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住宅', '無電梯公寓' from product_categories where key = 'apartment';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住宅', '華廈' from product_categories where key = 'large_building';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住宅', '大樓' from product_categories where key = 'large_building';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住宅', '樓中樓' from product_categories where key = 'large_building';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住宅', '透天' from product_categories where key = 'townhouse_villa';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住宅', '別墅' from product_categories where key = 'townhouse_villa';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住宅', '一般套房' from product_categories where key = 'suite';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住宅', '商務套房' from product_categories where key = 'suite';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住宅', '學生套房' from product_categories where key = 'suite';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住宅', '農舍' from product_categories where key = 'other';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住宅', '農業用' from product_categories where key = 'other';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住宅', '其他用' from product_categories where key = 'other';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住宅', '其他' from product_categories where key = 'other';
insert into product_category_rules (category_id, main_use_pattern, source_building_type, needs_review)
  values (null, '住宅', '住宅用', true);
insert into product_category_rules (category_id, main_use_pattern, source_building_type, needs_review)
  values (null, '住宅', '商業用', true);
insert into product_category_rules (category_id, main_use_pattern, source_building_type, needs_review)
  values (null, '住宅', '無', true);

-- 物件用途＝店面（不分物件型態）
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '店面', '' from product_categories where key = 'storefront';

-- 物件用途＝辦公（不分物件型態）
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '辦公', '' from product_categories where key = 'office';

-- 物件用途＝住辦
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住辦', '無電梯公寓' from product_categories where key = 'apartment';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住辦', '華廈' from product_categories where key = 'large_building';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住辦', '大樓' from product_categories where key = 'large_building';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住辦', '樓中樓' from product_categories where key = 'large_building';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住辦', '透天' from product_categories where key = 'townhouse_villa';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住辦', '別墅' from product_categories where key = 'townhouse_villa';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住辦', '一般套房' from product_categories where key = 'suite';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住辦', '其他' from product_categories where key = 'other';
insert into product_category_rules (category_id, main_use_pattern, source_building_type, needs_review)
  values (null, '住辦', '無', true);

-- 物件用途＝住店（跟「住辦」同一套對照）
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住店', '無電梯公寓' from product_categories where key = 'apartment';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住店', '華廈' from product_categories where key = 'large_building';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住店', '大樓' from product_categories where key = 'large_building';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住店', '樓中樓' from product_categories where key = 'large_building';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住店', '透天' from product_categories where key = 'townhouse_villa';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住店', '別墅' from product_categories where key = 'townhouse_villa';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住店', '一般套房' from product_categories where key = 'suite';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '住店', '其他' from product_categories where key = 'other';
insert into product_category_rules (category_id, main_use_pattern, source_building_type, needs_review)
  values (null, '住店', '無', true);

-- 物件用途＝車位（不分物件型態）
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '車位', '' from product_categories where key = 'parking';

-- 物件用途＝工廠
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '工廠', '住宅' from product_categories where key = 'factory';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '工廠', '賣場' from product_categories where key = 'factory';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '工廠', '工業區' from product_categories where key = 'factory';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '工廠', '標準' from product_categories where key = 'factory';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '工廠', '臨時' from product_categories where key = 'factory';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '工廠', '無電梯公寓' from product_categories where key = 'factory';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '工廠', '華廈' from product_categories where key = 'factory';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '工廠', '大樓' from product_categories where key = 'factory';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '工廠', '透天' from product_categories where key = 'factory';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '工廠', '別墅' from product_categories where key = 'factory';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '工廠', '一般套房' from product_categories where key = 'factory';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '工廠', '一般' from product_categories where key = 'factory';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '工廠', '其他' from product_categories where key = 'factory';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '工廠', '無' from product_categories where key = 'factory';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '工廠', '辦公' from product_categories where key = 'factory_office';

-- 物件用途＝土地／倉庫／其他（不分物件型態）
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '土地', '' from product_categories where key = 'land';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '倉庫', '' from product_categories where key = 'other';
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '其他', '' from product_categories where key = 'other';

-- 物件型態＝預售屋：圖片裡「預售屋」是獨立於用途/型態矩陣之外的一格，
-- 這裡用「物件用途萬用、物件型態=預售屋」讓任何用途只要型態選預售屋都直接歸類，
-- 不然「預售屋」這個分類會永遠配不到規則、選不到。
insert into product_category_rules (category_id, main_use_pattern, source_building_type)
  select id, '', '預售屋' from product_categories where key = 'presale';

-- 官方實價登錄：新增分類信心不足標記，category_id／building_type_raw／main_use 三者都已存在且互不覆蓋。
alter table official_transactions add column if not exists needs_review boolean not null default false;

-- 公司內部成交情報：新增情報來源類型（跟 match_status 配對狀態完全獨立)，
-- 以及手動輸入表單需要的欄位。match_status 沿用既有三個值（unmatched/candidate/matched），不擴充。
alter table internal_deals add column if not exists source_type text not null default 'internal_announcement'
  check (source_type in ('internal_announcement', 'external_brand_intel', 'other'));
alter table internal_deals add column if not exists main_use_input text not null default '';
alter table internal_deals add column if not exists building_type_input text not null default '';
alter table internal_deals add column if not exists needs_review boolean not null default false;
alter table internal_deals add column if not exists parking_raw text not null default '';
alter table internal_deals add column if not exists deal_brand text;
alter table internal_deals add column if not exists deal_branch text;
alter table internal_deals add column if not exists info_source text;
alter table internal_deals add column if not exists verified boolean not null default false;
alter table internal_deals add column if not exists internal_announced_date date;
alter table internal_deals add column if not exists info_received_date date;
alter table internal_deals add column if not exists community_name_input text not null default '';

create index if not exists internal_deals_source_type_idx on internal_deals (source_type);

-- 候選比對表：內部情報 ↔ 官方實登，系統只產生候選、不自動判定同一筆。
-- 跟 internal_deals.matched_official_id（人工確認後才寫入的「最終那一筆」）分開，
-- 兩邊原始資料全程不變動、不刪除。這張表本階段先建好，實際「尋找候選」比對功能留到下一階段做。
create table if not exists internal_deal_candidates (
  id uuid primary key default gen_random_uuid(),
  internal_deal_id uuid not null references internal_deals(id) on delete cascade,
  official_transaction_id uuid not null references official_transactions(id) on delete cascade,
  match_reason jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (internal_deal_id, official_transaction_id)
);

create index if not exists internal_deal_candidates_internal_idx on internal_deal_candidates (internal_deal_id);

alter table internal_deal_candidates enable row level security;
grant select, insert, update, delete on public.internal_deal_candidates to service_role;

-- ==========================================================================
-- 地圖範圍升級：Polygon 多邊形（保留 bbox 相容，純新增不動既有資料）
-- 一個區域可以同時有多個 bbox、多個 polygon，跟路段/地段/社區/地址關鍵字規則並存不互斥
-- ——這點 schema 本來就支援（market_radar_area_rules 對 market_radar_areas 是多對一）。
-- ==========================================================================
alter table market_radar_area_rules
  drop constraint if exists market_radar_area_rules_rule_type_check;
alter table market_radar_area_rules
  add constraint market_radar_area_rules_rule_type_check
  check (rule_type in ('road', 'district', 'section', 'community', 'address_keyword', 'bbox', 'polygon'));

-- polygon 格式：[{"lat":22.68,"lng":120.29}, ...]，至少 3 個點，首尾隱含自動封閉。
-- 跟 bbox 分開存成獨立欄位，不合併成通用 geometry 欄位，避免動到既有 bbox 資料的存放方式。
alter table market_radar_area_rules add column if not exists polygon jsonb;

-- ==========================================================================
-- official_transactions 一般門牌地址 geocoding（高雄市政府門牌坐標開放資料）
-- 只負責「地址 → lat/lng」，不碰 area_id、不做 Polygon/bbox 區域分類，那是下一階段的事。
-- lat/lng 欄位本來就存在（schema.sql 439 行附近），這裡只新增狀態/來源/可信程度追蹤欄位，
-- 讓同步服務知道哪些列已經處理過（不必每次重新解析已經 resolved 的資料）。
-- ==========================================================================
alter table official_transactions add column if not exists geocode_status text not null default 'pending'
  check (geocode_status in ('pending', 'resolved', 'failed', 'skipped_land_parcel', 'skipped_unparseable_address'));
-- 只在 geocode_status='resolved' 時有值：exact/normalized/approximate，定義見 scripts/geocoding/resolve-address.js
alter table official_transactions add column if not exists geocode_match_status text;
-- 例如 kcg_address_csv@2026-08-16，記錄是用哪一版門牌坐標資料解析出來的，供日後追查／重新解析用
alter table official_transactions add column if not exists geocode_source text;
-- 解析細節（matchMethod／matchedHouseNum／reason），保留給人工檢查用，不是給程式邏輯依賴的欄位
alter table official_transactions add column if not exists geocode_detail jsonb not null default '{}';
alter table official_transactions add column if not exists geocode_resolved_at timestamptz;

create index if not exists official_transactions_geocode_status_idx on official_transactions (geocode_status);

-- ==========================================================================
-- official_transaction ↔ market_radar_area 多對多命中結果
--
-- official_transactions.area_id 保留欄位不刪，但正式停用、不再雙寫——單一 nullable FK
-- 結構上無法表達「同時命中多個區域」，改用這張關聯表當唯一正式來源。
-- 這張表是「衍生／可重算」的快取結果，不是原始資料：official_transactions 本身
-- 不管有沒有座標、有沒有命中任何區域，永遠正常保留，這張表沒有列不代表那筆交易有問題。
--
-- unique(official_transaction_id, area_id)：同一筆交易對同一個區域最多一列，
-- 該區域底下同時命中好幾條 bbox/polygon 規則時，記在同一列的 matched_rule_ids 陣列裡，
-- 不是每條規則各開一列（避免同區域內部規則重疊造成計數混亂）。
-- ==========================================================================
create table if not exists official_transaction_area_matches (
  id uuid primary key default gen_random_uuid(),
  official_transaction_id uuid not null references official_transactions(id) on delete cascade,
  area_id uuid not null references market_radar_areas(id) on delete cascade,
  matched_rule_ids jsonb not null default '[]',
  computed_at timestamptz not null default now(),
  unique (official_transaction_id, area_id)
);

create index if not exists official_transaction_area_matches_area_idx on official_transaction_area_matches (area_id);
create index if not exists official_transaction_area_matches_txn_idx on official_transaction_area_matches (official_transaction_id);

alter table official_transaction_area_matches enable row level security;
grant select, insert, update, delete on public.official_transaction_area_matches to service_role;

-- ==========================================================================
-- recompute_area_matches：單一區域的「安全替換」在資料庫端一個 transaction 內完成。
--
-- 命中判定（isPointInBbox/isPointInPolygon）本身仍在應用層算好（沿用 market-radar-store.ts
-- 既有、已驗證過的同一套函式），這支 function 只負責「拿到這次算出來的新結果後，
-- 怎麼安全地把它跟舊結果做差異比對並寫回資料庫」這一段——這段才是真正需要 atomic
-- 保證的部分：insert 缺的、delete 多的、update 變了的，必須全部成功或全部不生效，
-- 不能中途失敗留下新舊混雜的半更新狀態。
--
-- p_matches 格式：[{ "official_transaction_id": "<uuid>", "matched_rule_ids": ["<uuid>", ...] }, ...]
-- 只放「這次算出來確實有命中」的交易；沒命中的交易完全不用出現在陣列裡，
-- 函式會自動把資料庫裡屬於這個區域、但這次不在新結果裡的舊列刪掉。
-- ==========================================================================
create or replace function recompute_area_matches(p_area_id uuid, p_matches jsonb)
returns table(inserted_count int, deleted_count int, updated_count int, unchanged_count int)
language plpgsql
as $$
declare
  v_inserted int;
  v_deleted int;
  v_updated int;
  v_unchanged int;
begin
  create temporary table _new_matches (
    official_transaction_id uuid primary key,
    matched_rule_ids jsonb
  ) on commit drop;

  insert into _new_matches (official_transaction_id, matched_rule_ids)
  select (elem->>'official_transaction_id')::uuid, coalesce(elem->'matched_rule_ids', '[]'::jsonb)
  from jsonb_array_elements(p_matches) as elem;

  create temporary table _old_matches on commit drop as
  select official_transaction_id, matched_rule_ids
  from official_transaction_area_matches
  where area_id = p_area_id;

  create temporary table _diff on commit drop as
  select
    coalesce(n.official_transaction_id, o.official_transaction_id) as official_transaction_id,
    n.matched_rule_ids as new_rule_ids,
    case
      when o.official_transaction_id is null then 'insert'
      when n.official_transaction_id is null then 'delete'
      when n.matched_rule_ids is distinct from o.matched_rule_ids then 'update'
      else 'unchanged'
    end as action
  from _new_matches n
  full outer join _old_matches o on o.official_transaction_id = n.official_transaction_id;

  delete from official_transaction_area_matches m
  using _diff d
  where m.area_id = p_area_id
    and m.official_transaction_id = d.official_transaction_id
    and d.action = 'delete';

  update official_transaction_area_matches m
  set matched_rule_ids = d.new_rule_ids, computed_at = now()
  from _diff d
  where m.area_id = p_area_id
    and m.official_transaction_id = d.official_transaction_id
    and d.action = 'update';

  insert into official_transaction_area_matches (official_transaction_id, area_id, matched_rule_ids, computed_at)
  select d.official_transaction_id, p_area_id, d.new_rule_ids, now()
  from _diff d
  where d.action = 'insert';

  select
    count(*) filter (where action = 'insert'),
    count(*) filter (where action = 'delete'),
    count(*) filter (where action = 'update'),
    count(*) filter (where action = 'unchanged')
  into v_inserted, v_deleted, v_updated, v_unchanged
  from _diff;

  return query select v_inserted, v_deleted, v_updated, v_unchanged;
end;
$$;

grant execute on function recompute_area_matches(uuid, jsonb) to service_role;

-- ==========================================================================
-- 通知中心：official_transaction_area_notifications
--
-- 只代表「這筆交易×這個區域的組合，已經實際透過某個通道成功送出通知」。
-- 這張表本身不等於「人工看過/確認過」——後台 Preview 頁面的唯讀檢視、
-- 「已預覽」之類的動作，一律不寫入這張表，避免未來真的接上 LINE 時，
-- 系統誤判「這筆已經人工看過＝已經推播過」而漏發。
-- unique(official_transaction_id, area_id) 的粒度跟 official_transaction_area_matches
-- 一致，確保同一筆交易在同一個區域最多只會被記錄通知過一次。
-- ==========================================================================
create table if not exists official_transaction_area_notifications (
  id uuid primary key default gen_random_uuid(),
  official_transaction_id uuid not null references official_transactions(id) on delete cascade,
  area_id uuid not null references market_radar_areas(id) on delete cascade,
  channel text not null check (channel in ('line')),
  notified_at timestamptz not null default now(),
  unique (official_transaction_id, area_id)
);

create index if not exists official_transaction_area_notifications_txn_idx
  on official_transaction_area_notifications (official_transaction_id);

alter table official_transaction_area_notifications enable row level security;
grant select, insert, update, delete on public.official_transaction_area_notifications to service_role;

-- ==========================================================================
-- 社區資料庫／社區自動辨識（第一階段：schema only，這階段不寫入任何資料）
--
-- 設計原則：
-- - communities 是「社區主檔」，由 Maggie 確認過的資料組成，不是官方資料的複製品。
-- - 一個 community 可以對應多個門牌（community_addresses），因為同一個社區常常
--   有好幾個不同的進出門牌／不同棟。
-- - 交易 × 社區的配對狀態獨立存在 official_transaction_community_candidates，
--   不直接覆蓋 official_transactions.community_id，配對邏輯可以隨時重跑、
--   保留歷史，原始交易資料完全不動。
-- ==========================================================================

alter table communities add column if not exists aliases text[] not null default '{}';
alter table communities add column if not exists total_floors int;
alter table communities add column if not exists building_type_raw text;
alter table communities add column if not exists created_from text not null default 'manual'
  check (created_from in ('manual', 'auto_matched'));

-- 一個社區可對應多個門牌（同社區不同棟/不同進出口地址）。
-- unique(district, road, house_number)：同一個門牌只能屬於一個社區，避免衝突。
create table if not exists community_addresses (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  district text not null,
  road text not null,
  house_number text not null,
  created_at timestamptz not null default now(),
  unique (district, road, house_number)
);

create index if not exists community_addresses_community_idx on community_addresses (community_id);

alter table community_addresses enable row level security;
grant select, insert, update, delete on public.community_addresses to service_role;

-- 交易 × 社區的配對狀態。community_id 為 null 代表「還沒配對到任何社區」
-- （needs_confirmation 或 no_community 都可能是 null，差別在 match_status）。
create table if not exists official_transaction_community_candidates (
  id uuid primary key default gen_random_uuid(),
  official_transaction_id uuid not null references official_transactions(id) on delete cascade,
  community_id uuid references communities(id) on delete set null,
  match_status text not null check (match_status in ('auto_matched', 'needs_confirmation', 'confirmed', 'no_community')),
  match_reason jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (official_transaction_id)
);

create index if not exists official_transaction_community_candidates_status_idx
  on official_transaction_community_candidates (match_status);

alter table official_transaction_community_candidates enable row level security;
grant select, insert, update, delete on public.official_transaction_community_candidates to service_role;

-- ==========================================================================
-- LINE 通知起算點設定（Phase 10.12）
--
-- 只保存一個值：line_digest_cutoff_at，決定 LINE 每日摘要「從哪個時間點之後產生的
-- area match 才算新資料」。單列（singleton）表，不做 key-value 通用設計，因為目前
-- 只有這一個需求。id 用 boolean + check(id) 強制整張表只能有一列。
--
-- 不用既有 table 存的原因：
-- - market_radar_areas／market_radar_area_rules 是「每個區域各自的設定」，cutoff 是
--   跨區域、全站只有一個值，語意不合，日後增減區域還要注意搬移。
-- - radar_sync_runs 是「每次執行的歷史紀錄」，不是「目前生效中的設定」，拿某一筆
--   run 的 finished_at 當 cutoff 會把「log」跟「設定」兩種語意混在一起。
-- ==========================================================================
create table if not exists market_radar_notification_settings (
  id boolean primary key default true,
  line_digest_cutoff_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint market_radar_notification_settings_singleton check (id)
);

alter table market_radar_notification_settings enable row level security;
grant select, insert, update, delete on public.market_radar_notification_settings to service_role;

-- ==========================================================================
-- 屋主回報系統：主要平台曝光追蹤（591／5168／樂屋網／官網）
-- 四個平台固定都在「主要平台曝光」這個業務分類裡，但技術上的追蹤能力不同
-- （自動追蹤／部分追蹤／人工紀錄，這個能力標籤寫死在程式碼常數，不是欄位）。
-- 每個案件每個平台只有一組追蹤設定（listing_url + started_at），設定一次即可，
-- 不用每週重填；每天的檢查結果各存一筆歷史紀錄到 seller_exposure_checks，
-- 不覆蓋舊資料，才能算得出「本週新增多少」。
-- ==========================================================================

create table if not exists seller_exposure_links (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  platform text not null check (platform in ('website', 'e591', 'e5168', 'leyou')),
  -- 樂屋網（人工紀錄）可以只填開始刊登日期＋備註，不強制要有網址；
  -- 591/5168/官網（自動／部分追蹤）一定要有網址才有得檢查，用下面的 check 擋。
  listing_url text,
  started_at date not null,
  current_status text not null default 'unverifiable' check (current_status in ('normal', 'inactive', 'unverifiable')),
  current_views int,
  last_checked_at timestamptz,
  error_reason text not null default '',
  manual_note text not null default '', -- Maggie 自己填的操作記錄（例如「更新首圖」），跟 Seller Report 的自動摘要句是兩回事
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, platform),
  check (platform = 'leyou' or listing_url is not null)
);

create table if not exists seller_exposure_checks (
  id uuid primary key default gen_random_uuid(),
  exposure_link_id uuid not null references seller_exposure_links(id) on delete cascade,
  checked_at timestamptz not null default now(),
  status text not null check (status in ('normal', 'inactive', 'unverifiable')),
  views int,
  error_reason text not null default ''
);

create index if not exists seller_exposure_links_seller_idx on seller_exposure_links (seller_id);
create index if not exists seller_exposure_checks_link_time_idx
  on seller_exposure_checks (exposure_link_id, checked_at desc);

alter table seller_exposure_links enable row level security;
alter table seller_exposure_checks enable row level security;
grant select, insert, update, delete on public.seller_exposure_links to service_role;
grant select, insert, update, delete on public.seller_exposure_checks to service_role;
