# CLAUDE.md — Rota (spor sosyal medyası mobil uygulaması)

Bu dosya Claude Code için proje hafızasıdır. Her oturumda önce bunu, sonra ilgili `docs/` dosyasını oku.

## Proje nedir?
**Rota**, harita merkezli bir spor sosyal medyası. Kullanıcı birkaç soruyu cevaplar (aktivite, süre, manzara, eğim, ekstralar), uygulama ona yürüyüş/koşu/bisiklet rotası üretir. Kullanıcılar popüler rotaları puanlar ve yorumlar, birbirini takip eder, yeni başlayanlar kurs alır. İlk hedef şehir: İstanbul.

Detaylar:
- Ürün ve özellikler → `docs/01-urun-ve-ozellikler.md`
- Ekranlar ve akışlar → `docs/02-ekranlar-ve-akislar.md`
- Teknik mimari ve rota algoritması → `docs/03-teknik-mimari.md`
- Veritabanı → `docs/04-veri-modeli.md`
- Fazlar, kurulum, riskler → `docs/05-yol-haritasi-ve-riskler.md`
- Tasarım referansı → `design/stitch/*.html` ve `design/stitch/DESIGN.md`
- İlerleme → `TASKS.md`

## Geliştirici bağlamı
- Geliştirici Windows kullanıyor; komutları PowerShell / Git Bash uyumlu ver.
- React/Next.js ve Python deneyimi var, React Native'e yeni. Yeni kavramları kısaca açıkla.
- Telefonda test: Expo Go → native modüller gelince EAS development build.

## Teknoloji yığını
- **Mobil:** Expo (güncel SDK) + TypeScript (strict) + Expo Router
- **UI:** NativeWind (Tailwind), token'lar `src/theme/tokens.ts`
- **Harita:** `@rnmapbox/maps`
- **Rota motoru:** OpenRouteService (`foot-walking`, `cycling-regular`, `round_trip`, `elevation=true`)
- **POI/manzara:** OpenStreetMap Overpass API
- **Backend:** Supabase (Postgres + PostGIS, Auth, Storage, Realtime, Edge Functions)
- **Konum:** `expo-location` + `expo-task-manager` (arka plan)
- **Ses:** `expo-speech` (Türkçe)
- **Yerel depolama:** `expo-sqlite` (canlı takip noktaları)
- **State:** Zustand (istemci) + TanStack Query (sunucu)
- **Hava:** Open-Meteo
- **İzleme:** Sentry + PostHog

## Klasör yapısı
```
app/
  (auth)/            welcome, login, onboarding
  (tabs)/            map, explore, record, feed, profile
  route-wizard/      step-1 … step-6, loading
  route-results.tsx
  activity/live.tsx, activity/summary.tsx
  route/[id].tsx, route/[id]/review.tsx
  courses/, events/, settings.tsx
src/
  components/        ui/ (Button, Card, Chip…), map/, route/, activity/
  lib/               supabase.ts, ors.ts, geo.ts, pace.ts
  stores/            wizardStore.ts, activityStore.ts
  hooks/
  theme/tokens.ts
  types/
supabase/
  migrations/
  functions/generate-routes/
  seed.sql
scripts/seed-routes.ts
design/stitch/
```

## Kod kuralları
- Arayüz metinleri **Türkçe**; kod, değişken, dosya adları **İngilizce**.
- Türkçe metinleri `src/i18n/tr.ts` içinde topla (ileride çok dil için).
- API anahtarları **asla istemcide değil**. ORS ve Overpass çağrıları Edge Function'da. İstemcide sadece `EXPO_PUBLIC_` önekli değerler (Supabase anon key, Mapbox public token).
- Her ekranda **loading, boş durum ve hata durumu** olsun.
- Dokunma alanları ≥ 44 pt, metin kontrastı WCAG AA.
- Birimler: km, dk, dk/km; ondalık ayraç virgül ("4,8 km").
- Tasarımı `design/stitch/` dosyalarına sadık uygula; token dışı renk kullanma.
- Supabase tablolarında RLS her zaman açık.
- Fonksiyonlar küçük ve test edilebilir; `src/lib/` saf fonksiyonları için Jest testi yaz.

## Sabitler (rota üretimi)
- Yürüyüş hızı 4,8 km/s, bisiklet 16 km/s, koşu varsayılan tempo 6:30 dk/km (kullanıcı ayarı geçerli).
- Eğim düzeltmesi: her 10 m tırmanış için +1 dk.
- Hedef mesafe toleransı ±%10.
- Manzara skoru: 100 m'de bir örnekle, 50 m tampon; sahil +3, park/orman +2, tarihi +1, ana yol −2; 0–100'e ölçekle; seçilen manzara türü ×2.
- "Düz" seçiliyse %6 üstü eğimli segmente ağır ceza.
- Rotadan sapma eşiği 40 m; GPS doğruluğu > 25 m olan noktaları at.

## Çalışma şekli
- Her görevde önce `TASKS.md`'ye bak; bitirdiğin maddeyi `[x]` yap.
- Büyük değişikliklerden önce kısa bir plan yaz ve onay iste.
- Her adım sonunda: ne yaptığını 3–5 maddede özetle, test için hangi komutu çalıştıracağımı yaz, önerilen commit mesajını ver.
- Emin olmadığın bir paket API'si varsa resmi dokümana göre doğrula; uydurma.
