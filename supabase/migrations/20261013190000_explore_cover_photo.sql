-- explore_routes: kart görseli için rotanın ilk fotoğrafı (cover_url). Dönüş tipi değiştiği için yeniden oluşturulur.

set search_path = public, extensions;

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
