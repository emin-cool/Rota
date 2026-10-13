-- P1.7: profil istatistikleri, gizlilik bölgesi RPC'leri, avatar deposu, "Rotalarım / Kaydedilenler" kapsamı.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Profil istatistikleri (yalnızca kendi aktiviteleri; RLS zaten sahibine açık)
-- ---------------------------------------------------------------------------
create or replace function public.my_stats()
returns table (total_distance_m bigint, activity_count int, total_duration_sec bigint)
language sql
stable
set search_path = public
as $$
  select
    coalesce(sum(a.distance_m), 0)::bigint,
    count(*)::int,
    coalesce(sum(a.duration_sec), 0)::bigint
  from public.activities a
  where a.user_id = (select auth.uid());
$$;

revoke all on function public.my_stats() from public, anon;
grant execute on function public.my_stats() to authenticated;

-- Geçen haftanın Pzt'sinden bu haftanın Pzr'sine 14 gün (Europe/Istanbul gün sınırları).
-- Önce geçen hafta (7 gün), sonra bu hafta (7 gün); aktivitesiz günler 0 döner.
create or replace function public.my_weekly_distance()
returns table (day date, distance_m bigint)
language sql
stable
set search_path = public
as $$
  with bounds as (
    select (date_trunc('week', (now() at time zone 'Europe/Istanbul'))::date - 7) as first_day
  )
  select
    d::date as day,
    coalesce((
      select sum(a.distance_m)
      from public.activities a
      where a.user_id = (select auth.uid())
        and (a.started_at at time zone 'Europe/Istanbul')::date = d::date
    ), 0)::bigint as distance_m
  from bounds, generate_series(bounds.first_day, bounds.first_day + 13, interval '1 day') d
  order by d;
$$;

revoke all on function public.my_weekly_distance() from public, anon;
grant execute on function public.my_weekly_distance() to authenticated;

-- ---------------------------------------------------------------------------
-- Gizlilik bölgesi: merkez + yarıçap (200–500 m) → daire poligonu (sunucuda üretilir)
-- ---------------------------------------------------------------------------
create or replace function public.set_privacy_zone(p_lng double precision, p_lat double precision, p_radius_m int)
returns void
language sql
set search_path = public, extensions
as $$
  update public.profiles
  set privacy_zone = st_buffer(
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    least(greatest(p_radius_m, 200), 500),
    16
  )::geography
  where user_id = (select auth.uid());
$$;

revoke all on function public.set_privacy_zone(double precision, double precision, int) from public, anon;
grant execute on function public.set_privacy_zone(double precision, double precision, int) to authenticated;

create or replace function public.clear_privacy_zone()
returns void
language sql
set search_path = public
as $$
  update public.profiles set privacy_zone = null where user_id = (select auth.uid());
$$;

revoke all on function public.clear_privacy_zone() from public, anon;
grant execute on function public.clear_privacy_zone() to authenticated;

-- Ayarlar ekranı için: kayıtlı bölgenin merkezi ve yarıçapı (bölge yoksa satır dönmez).
create or replace function public.my_privacy_zone_info()
returns table (lng double precision, lat double precision, radius_m int)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    st_x(c) as lng,
    st_y(c) as lat,
    round(st_distance(c::geography, st_pointn(st_exteriorring(g), 1)::geography))::int as radius_m
  from (
    select privacy_zone::geometry as g, st_centroid(privacy_zone::geometry) as c
    from public.profiles
    where user_id = (select auth.uid()) and privacy_zone is not null
  ) z;
$$;

revoke all on function public.my_privacy_zone_info() from public, anon;
grant execute on function public.my_privacy_zone_info() to authenticated;

-- ---------------------------------------------------------------------------
-- Avatar deposu (herkese açık okuma; yazma/silme yalnızca kendi klasörüne: {user_id}/…)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: kendi klasörüne yükle"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: kendi dosyasını güncelle"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: kendi dosyalarını gör"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: kendi dosyasını sil"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- explore_routes: p_scope ('public' | 'mine' | 'saved') — profildeki "Rotalarım" ve "Kaydedilenler"
-- aynı kartı ve sayfalamayı kullansın diye. Dönüş tipi aynı, parametre eklendiği için yeniden oluşturulur.
-- ---------------------------------------------------------------------------
drop function if exists public.explore_routes(text, text, int, int, text, text, numeric, boolean, text, int, int);

create function public.explore_routes(
  p_query text default null,
  p_activity text default null,
  p_min_duration int default null,
  p_max_duration int default null,
  p_difficulty text default null,
  p_district text default null,
  p_min_rating numeric default null,
  p_featured_only boolean default false,
  p_sort text default 'popular',
  p_limit int default 20,
  p_offset int default 0,
  p_scope text default 'public'
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
  geojson jsonb,
  saved boolean,
  cover_url text
)
language sql
stable
set search_path = public, extensions
as $$
  select
    r.id, r.title, r.activity_type, r.route_type, r.distance_m, r.elevation_gain_m,
    r.est_duration_min, r.scenic_score, r.difficulty, r.district,
    r.avg_rating, r.rating_count, r.completion_count, r.is_featured,
    st_x(r.start_point::geometry) as start_lng,
    st_y(r.start_point::geometry) as start_lat,
    st_asgeojson(st_simplifypreservetopology(r.geom::geometry, 0.00005), 5)::jsonb as geojson,
    exists (
      select 1 from public.saved_routes s
      where s.route_id = r.id and s.user_id = (select auth.uid())
    ) as saved,
    (select ph.url from public.route_photos ph where ph.route_id = r.id order by ph.created_at limit 1) as cover_url
  from public.routes r
  where (
      (p_scope = 'public' and r.is_public)
      or (p_scope = 'mine' and r.creator_id = (select auth.uid()))
      or (p_scope = 'saved' and exists (
        select 1 from public.saved_routes s2
        where s2.route_id = r.id and s2.user_id = (select auth.uid())
      ))
    )
    and (p_activity is null or r.activity_type = p_activity)
    and (p_min_duration is null or r.est_duration_min >= p_min_duration)
    and (p_max_duration is null or r.est_duration_min <= p_max_duration)
    and (p_difficulty is null or r.difficulty = p_difficulty)
    and (p_district is null or r.district = p_district)
    and (p_min_rating is null or r.avg_rating >= p_min_rating)
    and (not p_featured_only or r.is_featured)
    and (
      p_query is null or btrim(p_query) = ''
      or r.title ilike '%' || replace(replace(btrim(p_query), '%', '\%'), '_', '\_') || '%'
      or r.district ilike '%' || replace(replace(btrim(p_query), '%', '\%'), '_', '\_') || '%'
    )
  order by
    case when p_sort = 'newest' then r.created_at end desc,
    case when p_sort = 'featured' then r.is_featured end desc,
    r.completion_count desc, r.avg_rating desc, r.created_at desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.explore_routes(text, text, int, int, text, text, numeric, boolean, text, int, int, text) from public, anon;
grant execute on function public.explore_routes(text, text, int, int, text, text, numeric, boolean, text, int, int, text) to authenticated;
