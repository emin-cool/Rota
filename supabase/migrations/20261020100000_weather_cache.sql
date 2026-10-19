-- Hava durumu önbelleği (Edge Function `weather`). Yaklaşık 5 km'lik hücre başına 30 dk'lık tahmin saklanır.
-- Yalnızca service role okur/yazar (politika yok = istemciye kapalı); kullanıcı konumu burada tutulmaz,
-- yalnızca yuvarlanmış hücre anahtarı vardır.

set search_path = public, extensions;

create table public.weather_cache (
  -- "41.05:29.00" biçiminde yuvarlanmış hücre merkezi
  cell_key text primary key check (char_length(cell_key) between 3 and 40),
  provider text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

create index weather_cache_fetched_idx on public.weather_cache (fetched_at);

alter table public.weather_cache enable row level security;
revoke all on public.weather_cache from anon, authenticated;
