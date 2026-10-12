-- P1.5: gizlilik bölgesi kırpması + fotoğraf deposu

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Gizlilik bölgesi: track'in BAŞINDAKİ ve SONUNDAKİ bölge içi noktalar kırpılır (ev/iş konumu).
-- Ortadaki noktalar silinmez: silinirse iki nokta arası düz çizgi bölgeyi ele verir.
-- Kırpınca 2 noktadan az kalırsa track null olur. distance_m gerçek değerinde kalır.
-- Bölgeyi başkaları okuyamaz (profiles.privacy_zone kolon yetkisiyle kapalı);
-- trigger security definer olduğu için okuyabilir.
-- ---------------------------------------------------------------------------
create or replace function public.activities_apply_privacy_zone()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  zone geography;
  geom geometry;
  n int;
  i int;
  first_i int;
  last_i int;
begin
  if new.track is null then
    return new;
  end if;

  select p.privacy_zone into zone from public.profiles p where p.user_id = new.user_id;
  if zone is null then
    return new;
  end if;

  geom := new.track::geometry;
  n := st_npoints(geom);
  for i in 1..n loop
    if not st_intersects(zone, st_pointn(geom, i)::geography) then
      if first_i is null then
        first_i := i;
      end if;
      last_i := i;
    end if;
  end loop;

  if first_i is null or last_i - first_i < 1 then
    new.track := null;
  elsif first_i > 1 or last_i < n then
    new.track := st_makeline(
      array(select st_pointn(geom, g) from generate_series(first_i, last_i) g)
    )::geography;
  end if;
  return new;
end;
$$;
revoke all on function public.activities_apply_privacy_zone() from public, anon, authenticated;

create trigger activities_apply_privacy_zone
  before insert or update of track on public.activities
  for each row execute function public.activities_apply_privacy_zone();

-- ---------------------------------------------------------------------------
-- Storage: route-photos (herkese açık okuma; yol tahmin edilemez UUID).
-- Yükleme/silme yalnızca kendi klasörüne: {user_id}/…
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('route-photos', 'route-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "route-photos: kendi klasörüne yükle"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'route-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "route-photos: kendi dosyasını güncelle"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'route-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'route-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "route-photos: kendi dosyasını sil"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'route-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
