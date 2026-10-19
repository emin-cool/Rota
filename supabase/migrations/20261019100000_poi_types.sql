-- POI türleri: eczane, hastane ve market eklenir; "bank" (bench) kaldırılır (her bankı bilemeyiz, haritada gürültü).
-- Yeni türlerin verisi scripts/osm-import.mjs --poi-only ile yüklenir (docs/06 §OSM).
-- Silinen bank satırları OSM'den türetilmiş veridir; gerekirse import ile geri gelmez (artık çekilmiyor), yani kalıcı kaldırılır.

set search_path = public, extensions;

-- Yalnızca bank olan satırları sil; manzara kategorisi de taşıyanlarda yalnızca poi_type'ı boşalt.
delete from public.osm_features where poi_type = 'bench' and category is null;
update public.osm_features set poi_type = null where poi_type = 'bench';

alter table public.osm_features drop constraint osm_features_poi_type_check;
alter table public.osm_features
  add constraint osm_features_poi_type_check
  check (poi_type in ('water', 'toilet', 'cafe', 'pharmacy', 'market', 'hospital', 'transit'));
