-- generate-routes için kullanıcı başına günlük istek sayacı (limit: 24 saatte 30).
-- Sadece Edge Function (service role) yazar/okur; istemciye tamamen kapalı.

create table public.route_generation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index route_generation_log_user_idx
  on public.route_generation_log (user_id, created_at desc);

alter table public.route_generation_log enable row level security;
revoke all on public.route_generation_log from anon, authenticated;
