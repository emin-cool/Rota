-- Storage upload(upsert: true) mevcut nesneyi kontrol etmek için SELECT yetkisi ister;
-- yalnızca kendi klasörünü görebilsin (herkese açık bucket okuması bundan bağımsız çalışır).
create policy "route-photos: kendi dosyalarını gör"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'route-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
