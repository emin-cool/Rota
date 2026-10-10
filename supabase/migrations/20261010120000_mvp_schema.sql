-- Rota MVP şeması (docs/04-veri-modeli.md)
-- Tablolar: profiles, routes, route_photos, route_reviews, activities, saved_routes, route_cache
-- RLS her tabloda açık. İstemcinin yazamaması gereken kolonlar (sayaçlar, is_featured,
-- is_verified…) kolon bazlı GRANT ile kapatıldı; onları sadece trigger'lar günceller.

create extension if not exists postgis with schema extensions;

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Yardımcı: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text,
  avatar_url text,
  level text check (level in ('beginner', 'intermediate', 'advanced')),
  activity_prefs text[] not null default '{}'
    check (activity_prefs <@ array['walk', 'run', 'bike']),
  default_pace_sec_per_km int check (default_pace_sec_per_km between 150 and 1200),
  privacy_zone geography (Polygon, 4326),
  is_private boolean not null default false,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: okuma (gizli olmayanlar + kendi)"
  on public.profiles for select to authenticated
  using (not is_private or user_id = (select auth.uid()));

create policy "profiles: sahibi günceller"
  on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- insert: sadece handle_new_user trigger'ı (security definer). delete: auth.users cascade.

-- privacy_zone (ev konumu) başkalarına sızmasın: tablo SELECT'i kaldırılır,
-- yalnızca zararsız kolonlar okunabilir. İstemci `select *` yerine kolon listesi kullanır
-- (src/lib/profile.ts PROFILE_COLUMNS). Sahibi bölgesini my_privacy_zone() ile okur.
revoke all on public.profiles from anon, authenticated;
grant select (
  id, user_id, username, display_name, avatar_url, level, activity_prefs,
  default_pace_sec_per_km, is_private, onboarding_completed, created_at, updated_at
) on public.profiles to authenticated;
grant update (
  username, display_name, avatar_url, level, activity_prefs,
  default_pace_sec_per_km, privacy_zone, is_private, onboarding_completed
) on public.profiles to authenticated;

create or replace function public.my_privacy_zone()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select st_asgeojson(privacy_zone)::jsonb
  from public.profiles
  where user_id = (select auth.uid());
$$;
revoke all on function public.my_privacy_zone() from public, anon;
grant execute on function public.my_privacy_zone() to authenticated;

-- ---------------------------------------------------------------------------
-- Yeni kullanıcı → profiles satırı
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_name text;
  candidate text;
  attempts int := 0;
  shown_name text;
begin
  base_name := lower(regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
  if length(base_name) < 3 then
    base_name := 'rotaci';
  end if;
  base_name := left(base_name, 24);

  shown_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), '')
  );

  loop
    candidate := base_name || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 4);
    begin
      insert into public.profiles (user_id, username, display_name, avatar_url)
      values (
        new.id,
        candidate,
        shown_name,
        nullif(new.raw_user_meta_data ->> 'avatar_url', '')
      );
      exit;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts > 10 then
        raise;
      end if;
    end;
  end loop;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- routes
-- ---------------------------------------------------------------------------
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  description text,
  activity_type text not null check (activity_type in ('walk', 'run', 'bike')),
  route_type text not null check (route_type in ('loop', 'a_b', 'out_back')),
  geom geography (LineString, 4326) not null,
  start_point geography (Point, 4326) not null,
  distance_m int not null check (distance_m > 0),
  elevation_gain_m int not null default 0 check (elevation_gain_m >= 0),
  est_duration_min int check (est_duration_min > 0),
  scenic_score int check (scenic_score between 0 and 100),
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  district text,
  is_featured boolean not null default false,
  is_public boolean not null default true,
  avg_rating numeric(2, 1) not null default 0,
  rating_count int not null default 0,
  completion_count int not null default 0,
  created_at timestamptz not null default now()
);

create index routes_geom_gix on public.routes using gist (geom);
create index routes_start_point_gix on public.routes using gist (start_point);
create index routes_activity_idx on public.routes (activity_type) where is_public;
create index routes_creator_idx on public.routes (creator_id);
create index routes_popular_idx on public.routes (avg_rating desc, completion_count desc) where is_public;

alter table public.routes enable row level security;

create policy "routes: herkese açık olanı herkes, kendininkini sahibi okur"
  on public.routes for select to authenticated
  using (is_public or creator_id = (select auth.uid()));

create policy "routes: oluşturan ekler"
  on public.routes for insert to authenticated
  with check (creator_id = (select auth.uid()));

create policy "routes: oluşturan günceller"
  on public.routes for update to authenticated
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()));

create policy "routes: oluşturan siler"
  on public.routes for delete to authenticated
  using (creator_id = (select auth.uid()));

-- Sayaçlar, puan ve is_featured istemciden yazılamaz.
revoke all on public.routes from anon, authenticated;
grant select, delete on public.routes to authenticated;
grant insert (
  creator_id, title, description, activity_type, route_type, geom, start_point,
  distance_m, elevation_gain_m, est_duration_min, scenic_score, difficulty, district, is_public
) on public.routes to authenticated;
grant update (title, description, difficulty, district, is_public) on public.routes to authenticated;

-- Rota görünür mü? (alt tablo politikaları için; RLS'e takılmadan route_id kontrolü)
create or replace function public.can_see_route(p_route_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.routes r
    where r.id = p_route_id
      and (r.is_public or r.creator_id = (select auth.uid()))
  );
$$;
revoke all on function public.can_see_route(uuid) from public, anon;
grant execute on function public.can_see_route(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- route_photos
-- ---------------------------------------------------------------------------
create table public.route_photos (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  location geography (Point, 4326),
  created_at timestamptz not null default now()
);

create index route_photos_route_idx on public.route_photos (route_id);
create index route_photos_location_gix on public.route_photos using gist (location);

alter table public.route_photos enable row level security;

create policy "route_photos: görünür rotanın fotoğraflarını oku"
  on public.route_photos for select to authenticated
  using (public.can_see_route(route_id));

create policy "route_photos: kendi fotoğrafını ekle"
  on public.route_photos for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_see_route(route_id));

create policy "route_photos: kendi fotoğrafını sil"
  on public.route_photos for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.route_photos from anon;

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  route_id uuid references public.routes (id) on delete set null,
  activity_type text not null check (activity_type in ('walk', 'run', 'bike')),
  started_at timestamptz not null,
  duration_sec int not null check (duration_sec >= 0),
  moving_sec int check (moving_sec >= 0),
  distance_m int not null check (distance_m >= 0),
  avg_pace_sec_per_km int,
  elevation_gain_m int not null default 0 check (elevation_gain_m >= 0),
  track geography (LineString, 4326),
  visibility text not null default 'public' check (visibility in ('public', 'followers', 'private')),
  title text,
  created_at timestamptz not null default now()
);

create index activities_user_idx on public.activities (user_id, started_at desc);
create index activities_route_idx on public.activities (route_id);
create index activities_track_gix on public.activities using gist (track);

alter table public.activities enable row level security;

-- 'followers' görünürlüğü follows tablosu gelince (V2) ayrı bir politika ile açılacak.
create policy "activities: public olanı herkes, kendininkini sahibi okur"
  on public.activities for select to authenticated
  using (visibility = 'public' or user_id = (select auth.uid()));

create policy "activities: sahibi ekler"
  on public.activities for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "activities: sahibi günceller"
  on public.activities for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "activities: sahibi siler"
  on public.activities for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.activities from anon;

-- ---------------------------------------------------------------------------
-- route_reviews
-- ---------------------------------------------------------------------------
create table public.route_reviews (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  tags text[] not null default '{}',
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_id, user_id)
);

create index route_reviews_route_idx on public.route_reviews (route_id, created_at desc);

create trigger route_reviews_set_updated_at
  before update on public.route_reviews
  for each row execute function public.set_updated_at();

alter table public.route_reviews enable row level security;

create policy "route_reviews: görünür rotanın yorumlarını oku"
  on public.route_reviews for select to authenticated
  using (public.can_see_route(route_id));

-- Yorum yazmak için o rotada aktivite kaydı şart (doğrulanmış yorum).
create policy "route_reviews: rotayı tamamlayan yazar"
  on public.route_reviews for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.activities a
      where a.user_id = (select auth.uid()) and a.route_id = route_reviews.route_id
    )
  );

create policy "route_reviews: sahibi günceller"
  on public.route_reviews for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "route_reviews: sahibi siler"
  on public.route_reviews for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.route_reviews from anon, authenticated;
grant select, delete on public.route_reviews to authenticated;
grant insert (route_id, user_id, rating, comment, tags) on public.route_reviews to authenticated;
grant update (rating, comment, tags) on public.route_reviews to authenticated;

-- is_verified: insert politikası aktivite şartını zorunlu kıldığı için her yorum doğrulanmıştır.
create or replace function public.route_reviews_mark_verified()
returns trigger
language plpgsql
as $$
begin
  new.is_verified := true;
  return new;
end;
$$;

create trigger route_reviews_mark_verified
  before insert on public.route_reviews
  for each row execute function public.route_reviews_mark_verified();

-- avg_rating / rating_count güncelle
create or replace function public.recalc_route_rating(p_route_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.routes r
  set avg_rating = coalesce((select round(avg(v.rating)::numeric, 1) from public.route_reviews v where v.route_id = p_route_id), 0),
      rating_count = (select count(*) from public.route_reviews v where v.route_id = p_route_id)
  where r.id = p_route_id;
$$;
revoke all on function public.recalc_route_rating(uuid) from public, anon, authenticated;

create or replace function public.refresh_route_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalc_route_rating(old.route_id);
  else
    perform public.recalc_route_rating(new.route_id);
    if tg_op = 'UPDATE' and old.route_id is distinct from new.route_id then
      perform public.recalc_route_rating(old.route_id);
    end if;
  end if;
  return null;
end;
$$;

create trigger route_reviews_refresh_rating
  after insert or update of rating, route_id or delete on public.route_reviews
  for each row execute function public.refresh_route_rating();

-- completion_count
create or replace function public.bump_route_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.route_id is not null then
    update public.routes set completion_count = completion_count + 1 where id = new.route_id;
  end if;
  return null;
end;
$$;

create trigger activities_bump_completion
  after insert on public.activities
  for each row execute function public.bump_route_completion();

-- ---------------------------------------------------------------------------
-- saved_routes
-- ---------------------------------------------------------------------------
create table public.saved_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  route_id uuid not null references public.routes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, route_id)
);

create index saved_routes_route_idx on public.saved_routes (route_id);

alter table public.saved_routes enable row level security;

create policy "saved_routes: sadece sahibi okur"
  on public.saved_routes for select to authenticated
  using (user_id = (select auth.uid()));

create policy "saved_routes: sahibi ekler"
  on public.saved_routes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_see_route(route_id));

create policy "saved_routes: sahibi siler"
  on public.saved_routes for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.saved_routes from anon;

-- ---------------------------------------------------------------------------
-- route_cache (sadece Edge Function / service_role; politika yok = istemciye kapalı)
-- ---------------------------------------------------------------------------
create table public.route_cache (
  id uuid primary key default gen_random_uuid(),
  input_hash text not null unique,
  result jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index route_cache_expires_idx on public.route_cache (expires_at);

alter table public.route_cache enable row level security;
revoke all on public.route_cache from anon, authenticated;

-- ---------------------------------------------------------------------------
-- nearby_routes(lng, lat, radius_m, activity) — yakındaki popüler rotalar
-- security invoker: routes RLS'i geçerli. Liste için hafif kolonlar döner.
-- ---------------------------------------------------------------------------
create or replace function public.nearby_routes(
  lng double precision,
  lat double precision,
  radius_m int default 3000,
  activity text default null
)
returns table (
  id uuid,
  title text,
  activity_type text,
  route_type text,
  distance_m int,
  elevation_gain_m int,
  est_duration_min int,
  scenic_score int,
  difficulty text,
  district text,
  avg_rating numeric,
  rating_count int,
  completion_count int,
  is_featured boolean,
  start_lng double precision,
  start_lat double precision,
  distance_to_start_m double precision
)
language sql
stable
set search_path = public, extensions
as $$
  with origin as (
    select st_setsrid(st_makepoint(lng, lat), 4326)::geography as g
  )
  select
    r.id, r.title, r.activity_type, r.route_type, r.distance_m, r.elevation_gain_m,
    r.est_duration_min, r.scenic_score, r.difficulty, r.district,
    r.avg_rating, r.rating_count, r.completion_count, r.is_featured,
    st_x(r.start_point::geometry) as start_lng,
    st_y(r.start_point::geometry) as start_lat,
    st_distance(r.start_point, o.g) as distance_to_start_m
  from public.routes r, origin o
  where r.is_public
    and (activity is null or r.activity_type = activity)
    and st_dwithin(r.start_point, o.g, least(greatest(radius_m, 100), 50000))
  order by r.avg_rating desc, r.completion_count desc, distance_to_start_m asc
  limit 50;
$$;

revoke all on function public.nearby_routes(double precision, double precision, int, text) from public, anon;
grant execute on function public.nearby_routes(double precision, double precision, int, text) to authenticated;
