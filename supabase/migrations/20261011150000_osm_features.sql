-- OSM manzara/mola verisi (İstanbul) — rota skorlaması için kendi veritabanımızda.
-- Canlı Overpass, Supabase Edge'den güvenilir çalışmadığı için veri scripts/osm-import.mjs ile
-- önceden yüklenir; generate-routes bunu osm_features_in_bbox() ile okur.
-- Tablo istemciye kapalıdır (RLS açık, politika yok); yalnızca service_role erişir.

set search_path = public, extensions;

create table public.osm_features (
  osm_type text not null check (osm_type in ('node', 'way', 'relation')),
  osm_id bigint not null,
  -- İlişkilerde (çoklu çokgen) üye sırası; düğüm ve yollarda 0.
  part int not null default 0,
  -- Manzara kategorisi (docs/03 skorlama): coast=sahil/su, green=park/orman, historic, mainRoad
  category text check (category in ('coast', 'green', 'historic', 'mainRoad')),
  -- Mola/POI türü
  poi_type text check (poi_type in ('water', 'toilet', 'cafe', 'bench', 'transit')),
  name text,
  -- Kapalı çokgen (park, göl…): rota içindeyken de "yakın" sayılır.
  area boolean not null default false,
  geom geometry (Geometry, 4326) not null,
  imported_at timestamptz not null default now(),
  primary key (osm_type, osm_id, part),
  check (category is not null or poi_type is not null)
);

create index osm_features_geom_gix on public.osm_features using gist (geom);

alter table public.osm_features enable row level security;
revoke all on public.osm_features from anon, authenticated;

-- Kutu içindeki tüm nesneleri tek bir jsonb dizisi olarak döndürür (PostgREST satır sınırına takılmaz).
-- Her eleman: {c: kategori, p: poi türü, n: ad, a: alan mı, g: GeoJSON koordinatları}
create or replace function public.osm_features_in_bbox(
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision
)
returns jsonb
language sql
stable
set search_path = public, extensions
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'c', f.category,
        'p', f.poi_type,
        'n', f.name,
        'a', f.area,
        'g', (st_asgeojson(f.geom, 6)::jsonb) -> 'coordinates'
      )
    ),
    '[]'::jsonb
  )
  from (
    select category, poi_type, name, area, geom
    from public.osm_features
    where geom && st_makeenvelope(p_west, p_south, p_east, p_north, 4326)
    limit 30000
  ) f;
$$;

revoke all on function public.osm_features_in_bbox(double precision, double precision, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.osm_features_in_bbox(double precision, double precision, double precision, double precision)
  to service_role;
