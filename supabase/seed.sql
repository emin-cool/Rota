-- GELİŞTİRME İÇİN ÖRNEK ROTALAR (gerçek veri değildir; puanlar ve sayaçlar uydurmadır).
-- Çalıştırma: Supabase Dashboard -> SQL Editor'e yapıştır -> Run.
-- Temizleme:  delete from public.routes where description like 'ÖRNEK VERİ%';
-- P1.7'de bu dosya gerçek 30 rotalık seed ile değiştirilecek.
-- Koordinatlar yaklaşıktır (kıyı şeridini kabaca izler); uzunluk geometriden hesaplanır.

set search_path = public, extensions;

delete from public.routes where description like 'ÖRNEK VERİ%';

with samples (title, activity_type, route_type, wkt, difficulty, district, scenic, rating, rcount, ccount, featured) as (
  values
  ('Emirgan - Bebek Sahil Yürüyüşü', 'walk', 'a_b',
   'LINESTRING(29.0535 41.1085, 29.0520 41.1030, 29.0510 41.0990, 29.0540 41.0920, 29.0565 41.0860, 29.0520 41.0820, 29.0460 41.0790, 29.0430 41.0770)',
   'easy', 'Sarıyer', 88, 4.7, 312, 140, true),
  ('Bebek - Ortaköy Sabah Koşusu', 'run', 'a_b',
   'LINESTRING(29.0430 41.0770, 29.0432 41.0680, 29.0390 41.0560, 29.0330 41.0520, 29.0270 41.0475)',
   'medium', 'Beşiktaş', 82, 4.9, 520, 260, true),
  ('Yıldız Parkı Turu', 'walk', 'loop',
   'LINESTRING(29.0130 41.0480, 29.0160 41.0495, 29.0190 41.0480, 29.0180 41.0455, 29.0145 41.0445, 29.0125 41.0460, 29.0130 41.0480)',
   'easy', 'Beşiktaş', 74, 4.5, 98, 40, false),
  ('Caddebostan - Bostancı Bisiklet Yolu', 'bike', 'a_b',
   'LINESTRING(29.0250 40.9770, 29.0360 40.9690, 29.0600 40.9650, 29.0780 40.9600, 29.0950 40.9550)',
   'easy', 'Kadıköy', 79, 4.6, 187, 90, false),
  ('Belgrad Ormanı Patika Turu', 'run', 'loop',
   'LINESTRING(28.9890 41.1830, 28.9930 41.1860, 28.9990 41.1850, 29.0010 41.1810, 28.9960 41.1780, 28.9910 41.1790, 28.9890 41.1830)',
   'hard', 'Sarıyer', 91, 4.8, 143, 55, false)
)
insert into public.routes (
  creator_id, title, description, activity_type, route_type, geom, start_point,
  distance_m, elevation_gain_m, est_duration_min, scenic_score, difficulty, district,
  is_featured, is_public, avg_rating, rating_count, completion_count
)
select
  null,
  s.title,
  'ÖRNEK VERİ — geliştirme amaçlı, gerçek bir rota değildir.',
  s.activity_type,
  s.route_type,
  g.geom,
  st_startpoint(g.geom::geometry)::geography,
  round(st_length(g.geom))::int,
  case s.difficulty when 'hard' then 120 when 'medium' then 40 else 10 end,
  greatest(1, round(st_length(g.geom) / 1000.0 /
    case s.activity_type when 'bike' then 16.0 when 'run' then 9.2 else 4.8 end * 60))::int,
  s.scenic,
  s.difficulty,
  s.district,
  s.featured,
  true,
  s.rating,
  s.rcount,
  s.ccount
from samples s
cross join lateral (select st_geogfromtext(s.wkt) as geom) g;
