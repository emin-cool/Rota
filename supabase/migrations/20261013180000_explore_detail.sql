-- P1.6: Keşfet + rota detayı + yorumlar için sorgular.
-- Hepsi security invoker (RLS geçerli) — istisna: route_pois (osm_features istemciye kapalı).

set search_path = public, extensions;

-- Yükseklik profili [{d, z}, ...]: sihirbazdan üretilen rotada dolar, seed rotalarında boş kalır.
alter table public.routes add column elevation_profile jsonb;
grant insert (elevation_profile) on public.routes to authenticated;

-- ---------------------------------------------------------------------------
-- explore_routes: filtre + sıralama + sayfalama
-- ---------------------------------------------------------------------------
create or replace function public.explore_routes(
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
  p_offset int default 0
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
  saved boolean
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
    ) as saved
  from public.routes r
  where r.is_public
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

revoke all on function public.explore_routes(text, text, int, int, text, text, numeric, boolean, text, int, int) from public, anon;
grant execute on function public.explore_routes(text, text, int, int, text, text, numeric, boolean, text, int, int) to authenticated;

-- Filtre sheet'indeki ilçe listesi
create or replace function public.route_districts()
returns text[]
language sql
stable
set search_path = public
as $$
  select coalesce(array_agg(d order by d), '{}')
  from (select distinct district as d from public.routes where is_public and district is not null) x;
$$;

revoke all on function public.route_districts() from public, anon;
grant execute on function public.route_districts() to authenticated;

-- ---------------------------------------------------------------------------
-- route_detail: tek rota + tam çizgi + oluşturan + fotoğraflar
-- ---------------------------------------------------------------------------
create or replace function public.route_detail(p_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  activity_type text,
  route_type text,
  distance_m int,
  elevation_gain_m int,
  est_duration_min int,
  scenic_score int,
  difficulty text,
  district text,
  is_featured boolean,
  is_public boolean,
  avg_rating numeric,
  rating_count int,
  completion_count int,
  created_at timestamptz,
  start_lng double precision,
  start_lat double precision,
  geojson jsonb,
  elevation_profile jsonb,
  creator_id uuid,
  creator_name text,
  creator_avatar text,
  photos text[],
  saved boolean
)
language sql
stable
set search_path = public, extensions
as $$
  select
    r.id, r.title, r.description, r.activity_type, r.route_type, r.distance_m,
    r.elevation_gain_m, r.est_duration_min, r.scenic_score, r.difficulty, r.district,
    r.is_featured, r.is_public, r.avg_rating, r.rating_count, r.completion_count, r.created_at,
    st_x(r.start_point::geometry) as start_lng,
    st_y(r.start_point::geometry) as start_lat,
    st_asgeojson(st_simplifypreservetopology(r.geom::geometry, 0.00001), 6)::jsonb as geojson,
    r.elevation_profile,
    r.creator_id,
    coalesce(p.display_name, p.username) as creator_name,
    p.avatar_url as creator_avatar,
    coalesce(
      (select array_agg(ph.url order by ph.created_at) from public.route_photos ph where ph.route_id = r.id),
      '{}'
    ) as photos,
    exists (
      select 1 from public.saved_routes s
      where s.route_id = r.id and s.user_id = (select auth.uid())
    ) as saved
  from public.routes r
  left join public.profiles p on p.user_id = r.creator_id
  where r.id = p_id;
$$;

revoke all on function public.route_detail(uuid) from public, anon;
grant execute on function public.route_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Puan dağılımı + en çok kullanılan etiketler
-- ---------------------------------------------------------------------------
create or replace function public.route_rating_summary(p_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'count', (select count(*) from public.route_reviews where route_id = p_id),
    'avg', coalesce((select round(avg(rating)::numeric, 1) from public.route_reviews where route_id = p_id), 0),
    'dist', jsonb_build_object(
      '1', (select count(*) from public.route_reviews where route_id = p_id and rating = 1),
      '2', (select count(*) from public.route_reviews where route_id = p_id and rating = 2),
      '3', (select count(*) from public.route_reviews where route_id = p_id and rating = 3),
      '4', (select count(*) from public.route_reviews where route_id = p_id and rating = 4),
      '5', (select count(*) from public.route_reviews where route_id = p_id and rating = 5)
    ),
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object('tag', t.tag, 'count', t.n) order by t.n desc, t.tag)
      from (
        select tag, count(*) as n
        from public.route_reviews rv, unnest(rv.tags) as tag
        where rv.route_id = p_id
        group by tag
        order by n desc, tag
        limit 6
      ) t
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.route_rating_summary(uuid) from public, anon;
grant execute on function public.route_rating_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Yorum listesi (yorumcu adı + o kişinin bu rotadaki fotoğrafları)
-- ---------------------------------------------------------------------------
create or replace function public.route_reviews_list(
  p_id uuid,
  p_limit int default 10,
  p_offset int default 0
)
returns table (
  id uuid,
  user_id uuid,
  rating smallint,
  comment text,
  tags text[],
  is_verified boolean,
  created_at timestamptz,
  display_name text,
  avatar_url text,
  photos text[],
  mine boolean
)
language sql
stable
set search_path = public
as $$
  select
    rv.id, rv.user_id, rv.rating, rv.comment, rv.tags, rv.is_verified, rv.created_at,
    coalesce(p.display_name, p.username) as display_name,
    p.avatar_url,
    coalesce(
      (select array_agg(ph.url order by ph.created_at)
       from public.route_photos ph
       where ph.route_id = rv.route_id and ph.user_id = rv.user_id),
      '{}'
    ) as photos,
    rv.user_id = (select auth.uid()) as mine
  from public.route_reviews rv
  left join public.profiles p on p.user_id = rv.user_id
  where rv.route_id = p_id
  order by (rv.user_id = (select auth.uid())) desc, rv.created_at desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.route_reviews_list(uuid, int, int) from public, anon;
grant execute on function public.route_reviews_list(uuid, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- route_pois: rotaya 75 m içindeki mola noktaları (osm_features istemciye kapalı → security definer)
-- ---------------------------------------------------------------------------
create or replace function public.route_pois(p_id uuid)
returns table (poi_type text, n int, sample_name text)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with r as (
    select geom from public.routes
    where id = p_id and public.can_see_route(p_id)
  ),
  near as (
    select f.poi_type, f.osm_type, f.osm_id, f.name
    from public.osm_features f, r
    where f.poi_type is not null
      and f.geom && st_expand(r.geom::geometry, 0.001)
      and st_dwithin(f.geom::geography, r.geom, 75)
  )
  select
    poi_type,
    count(distinct (osm_type, osm_id))::int as n,
    (array_agg(name order by name) filter (where name is not null))[1] as sample_name
  from near
  group by poi_type
  order by n desc;
$$;

revoke all on function public.route_pois(uuid) from public, anon;
grant execute on function public.route_pois(uuid) to authenticated;
