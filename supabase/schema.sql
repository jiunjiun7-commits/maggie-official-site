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
