# 06 — Supabase kurulumu (P0.2)

## 1. Proje ve anahtarlar
1. supabase.com → **New project** (bölge: Frankfurt `eu-central-1` İstanbul'a en yakın).
2. **Project Settings → API**: `Project URL` ve `anon public` anahtarını `.env` dosyasına yaz
   (`.env.example`'ı kopyala):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```
   `service_role` anahtarını **asla** istemciye / `.env`'e koyma.

## 2. Migration'ı uygula
```bash
npx supabase login
npx supabase link --project-ref <ref>      # ref: proje URL'indeki xxxx kısmı
npm run db:push                            # supabase db push
```
PostGIS migration içinde açılıyor (`create extension postgis with schema extensions`).
Doğrulama: Dashboard → **Table Editor** → `profiles, routes, route_photos, route_reviews, activities, saved_routes, route_cache`.

## 3. Tipleri üret
```bash
npm run db:types
```
Çıktı `src/types/database.generated.ts` dosyasına yazılır (Supabase'in ürettiği ham tipler).
`src/types/database.ts` elle yazılmış uygulama tipleridir (`ProfileRow`, `ActivityType`…);
üretilen dosyayla karşılaştırıp uyuşmazlık varsa elle olanı düzelt, üzerine yazma.

## 4. Auth ayarları (Dashboard → Authentication)
- **Providers → Email**: açık. Geliştirirken *Confirm email*'i kapatmak testi kolaylaştırır.
- **URL Configuration → Redirect URLs**: `rota://**` ekle (Google dönüşü ve şifre sıfırlama için);
  Expo Go ile denerken `exp://**` de ekle.
- **Providers → Google**: Google Cloud Console'da bir *Web* OAuth client oluştur, Client ID/Secret'ı
  Supabase'e gir; Google tarafında *Authorized redirect URI* olarak Supabase'in gösterdiği
  `https://<ref>.supabase.co/auth/v1/callback` adresini ekle.
- **Providers → Apple**: Apple Developer hesabı (99 $/yıl) gerekir; Services ID + key oluşturup
  Supabase'e gir. Yerel Apple girişi sadece iOS development build / App Store sürümünde çalışır.

## 5. Uçtan uca kontrol
1. `npx expo start` → kayıt ol → "Seni tanıyalım" → "Konumunu paylaş" → ana ekran.
2. SQL Editor: `select username, level, activity_prefs, default_pace_sec_per_km, onboarding_completed from profiles;`

## Notlar
- `profiles.privacy_zone` (ev konumu) için istemciye kolon izni verilmedi; uygulama `select('*')`
  yerine `PROFILE_COLUMNS` kullanır (`src/lib/profile.ts`). Yeni kolon eklersen migration'da
  `grant select (...)` listesine de ekle.
- `routes` sayaçları (`avg_rating`, `completion_count`, `is_featured`) ve `route_reviews.is_verified`
  istemciden yazılamaz; sadece trigger'lar günceller.
- `route_cache` istemciye tamamen kapalı (politika yok); sadece Edge Function (service role) kullanır.

## Rota üretimi (P1.2): ORS + OSM verisi
1. **ORS anahtarı** (Supabase secret, istemciye gelmez):
   `npx supabase secrets set ORS_API_KEY=anahtarin`
2. **Migration'lar:** `npm run db:push` (route_generation_log ve osm_features tabloları).
3. **OSM verisini yükle** (İstanbul, bir kerelik, ~10–20 dk, kesilirse devam eder). `.env`'e
   `SUPABASE_SERVICE_ROLE_KEY=...` (Dashboard → Project Settings → API Keys → *Secret keys*) ekle:
   - `node scripts/osm-import.mjs --dry` → 1 karo çeker, hiçbir şey yazmaz
   - `node scripts/osm-import.mjs` → tamamını yükler (`--reset` baştan başlatır)
4. **Fonksiyonu yayınla** (Docker gerekmez): `npx supabase functions deploy generate-routes --use-api`
5. **Dene:** `.env`'e `TEST_EMAIL` / `TEST_PASSWORD` yaz → `node scripts/test-generate-routes.mjs`

Neden canlı Overpass yok: herkese açık Overpass sunucuları Supabase Edge'den kararlı çalışmıyor
(HTTP 406/500/timeout). Bu yüzden veri önceden `osm_features` tablosuna alınır ve
`osm_features_in_bbox()` ile okunur. Yeni bir şehir eklemek için script'i `--bbox` ile çalıştır.

## Aktivite özeti (P1.5)
1. `npm run db:push` → `20261013120000_activity_summary.sql` (gizlilik bölgesi trigger'ı + `route-photos` bucket'ı).
2. **Gizlilik kırpmasını dene** (SQL Editor; `<UID>` = kendi `auth.users.id`). Önce profiline küçük bir bölge ver,
   sonra başı ve sonu bölgede olan bir track ekle; başı/sonu kırpılmış olmalı:
   ```sql
   update profiles set privacy_zone = st_buffer(st_setsrid(st_makepoint(29.0, 41.0), 4326)::geography, 200)
     where user_id = '<UID>';
   insert into activities (user_id, activity_type, started_at, duration_sec, distance_m, track)
   values ('<UID>', 'walk', now(), 600, 1000,
     'SRID=4326;LINESTRING(29.0 41.0, 29.0005 41.0, 29.01 41.01, 29.02 41.02, 29.0 41.0)');
   select st_npoints(track::geometry) from activities order by created_at desc limit 1; -- 3 beklenir
   ```
   (Denemeden sonra test satırını ve `privacy_zone`'u temizle.)
3. Fotoğraflar `route-photos/{user_id}/{activity_id}-{n}.jpg` yoluna yüklenir; bucket herkese açık
   okunur (yollar tahmin edilemez), yazma/silme yalnızca kendi klasörüne.
