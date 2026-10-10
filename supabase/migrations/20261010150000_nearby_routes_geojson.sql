-- nearby_routes artık rotanın çizgisini (GeoJSON LineString) de döndürür; ana haritada çizmek için.
-- Dönüş tipi değiştiği için fonksiyon önce düşürülür. Çizgi ~5 m toleransla sadeleştirilir
-- (50 rota x binlerce nokta mobil ağı şişirmesin).

drop function if exists public.nearby_routes(double precision, double precision, int, text);

create function public.nearby_routes(
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
  distance_to_start_m double precision,
  geojson jsonb
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
    st_distance(r.start_point, o.g) as distance_to_start_m,
    st_asgeojson(st_simplifypreservetopology(r.geom::geometry, 0.00005), 5)::jsonb as geojson
  from public.routes r, origin o
  where r.is_public
    and (activity is null or r.activity_type = activity)
    and st_dwithin(r.start_point, o.g, least(greatest(radius_m, 100), 50000))
  order by r.avg_rating desc, r.completion_count desc, distance_to_start_m asc
  limit 50;
$$;

revoke all on function public.nearby_routes(double precision, double precision, int, text) from public, anon;
grant execute on function public.nearby_routes(double precision, double precision, int, text) to authenticated;
