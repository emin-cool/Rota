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
