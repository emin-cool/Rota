-- P2.1b: öne çıkan rota otomasyonu.
-- Kural (docs/04): puan >= 4,3 ve tamamlanma (completion_count) >= 20 olan HERKESE AÇIK rotalar `is_featured = true` olur.
-- Yalnızca EKLER, hiç kaldırmaz: 30 seed rota elle öne çıkarıldı (puansız) ve öyle kalmalı; ayrıca bir rotanın puanı
-- sonradan düşse bile editör seçkisi gibi kalır. Kaldırmak istenirse elle yapılır.

create or replace function public.refresh_featured_routes()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.routes
  set is_featured = true
  where is_public
    and not is_featured
    and avg_rating >= 4.3
    and completion_count >= 20;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- İstemci çağıramaz; yalnızca zamanlayıcı (postgres) ve service role.
revoke all on function public.refresh_featured_routes() from public, anon, authenticated;
grant execute on function public.refresh_featured_routes() to service_role;

-- Günlük çalıştırma: pg_cron. Supabase'te eklenti bu SQL ile açılır; izin hatası verirse
-- Dashboard → Database → Extensions → pg_cron'u açıp migration'ı yeniden çalıştır.
create extension if not exists pg_cron with schema pg_catalog;

-- Aynı adlı iş varsa önce kaldır (migration tekrar çalışırsa çift iş oluşmasın).
select cron.unschedule(jobid) from cron.job where jobname = 'refresh-featured-routes';

-- Her gün 03:00 UTC (İstanbul 06:00).
select cron.schedule(
  'refresh-featured-routes',
  '0 3 * * *',
  $$select public.refresh_featured_routes()$$
);

-- İlk çalıştırma: şu an ölçütü karşılayan rota varsa hemen işaretlensin.
select public.refresh_featured_routes();
