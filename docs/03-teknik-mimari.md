# 03 — Teknik mimari

## Teknoloji yığını

| Katman | Seçim | Neden |
| --- | --- | --- |
| Mobil | Expo + TypeScript + Expo Router | Windows'tan geliştirme, iOS build EAS ile bulutta |
| UI | NativeWind + `src/theme/tokens.ts` | Stitch HTML/Tailwind çıktısı kolay taşınır |
| Harita | `@rnmapbox/maps` | Özel stil, çizgi katmanları, offline |
| Rota motoru | OpenRouteService → ileride kendi GraphHopper/Valhalla | `round_trip` ile dönüşlü rota hazır |
| Eğim | ORS `elevation=true` | Ayrı servis gerekmez |
| Manzara/POI | Overpass API (OSM) | Sahil, park, çeşme, tuvalet, kafe |
| Backend | Supabase (Postgres+PostGIS, Auth, Storage, Realtime, Edge Functions) | Hızlı, coğrafi sorgu |
| Konum | `expo-location` + `expo-task-manager` | Arka plan GPS |
| Yerel kayıt | `expo-sqlite` | Uygulama kapanırsa veri kaybolmaz |
| Ses | `expo-speech` | Türkçe bildirim |
| State | Zustand + TanStack Query | Basit global state + sunucu önbelleği |
| Hava | Open-Meteo | Ücretsiz, anahtarsız |
| Bildirim | Expo Notifications | Kurs hatırlatıcı |
| İzleme | Sentry + PostHog | Hata + kullanım |

## Rota üretim akışı (`supabase/functions/generate-routes`)

1. Uygulama sihirbaz cevaplarını Edge Function'a gönderir (API anahtarları istemcide değil).
2. Fonksiyon süreyi mesafeye çevirir (`src/lib/pace.ts` ile aynı mantık).
3. ORS'den 6–8 aday rota ister:
   - Dönüşlü: `options.round_trip = { length, points: 3–5, seed }`, farklı `seed` değerleri
   - A → B: `alternative_routes = { target_count: 3 }`
   - Profil: yürüyüş/koşu `foot-walking` (patika için `foot-hiking`), bisiklet `cycling-regular`
   - `elevation: true`, `extra_info: ["steepness", "surface", "waytype"]`
4. Mesafe toleransı (±%10) dışında kalanları ele.
5. Her aday için Overpass'tan rotanın bbox'ı içindeki etiketleri tek sorguda çek, sonra rota üstünde 50 m tampon kontrolü yap.
6. Skorla, en iyi 3'ü seç, etiketle, GeoJSON + istatistik + POI döndür.
7. Sonucu `route_cache` tablosuna 24 saatliğine yaz (anahtar: girdilerin hash'i + başlangıç 100 m'ye yuvarlanmış).

### Girdi şeması
```ts
type GenerateRoutesInput = {
  activityType: 'walk' | 'run' | 'bike';
  routeType: 'loop' | 'a_b' | 'out_back';
  start: [lng: number, lat: number];
  end?: [number, number];
  durationMin?: number;
  distanceM?: number;
  paceSecPerKm?: number;              // koşu için
  scenery: ('coast' | 'green' | 'historic' | 'any')[];
  slope: 'flat' | 'some' | 'hilly';
  extras: {
    avoidTraffic?: boolean; litStreets?: boolean; amenities?: boolean;
    transitEnd?: boolean; dog?: boolean; stroller?: boolean;
    surface?: 'paved' | 'unpaved' | 'any'; bikeLanes?: boolean;
  };
};
```

### Çıktı şeması
```ts
type RouteOption = {
  label: 'En manzaralı' | 'En düz' | 'En kısa' | string;
  geojson: GeoJSON.LineString;
  distanceM: number;
  estDurationMin: number;
  elevationGainM: number;
  elevationProfile: { d: number; z: number }[];   // d: metre, z: rakım
  scenicScore: number;                             // 0–100
  pois: { type: 'water' | 'toilet' | 'cafe' | 'bench' | 'transit'; coord: [number, number]; name?: string }[];
};
```

## Skorlama

**Manzara skoru (0–100):**
- Rota her 100 m'de örneklenir; her örnek için 50 m çevresine bakılır.
- `natural=coastline` / `natural=water` → +3; `leisure=park`, `landuse=forest`, `natural=wood` → +2; `historic=*` → +1; `highway=primary|trunk|motorway` → −2.
- Kullanıcının seçtiği manzara türünün puanı ×2.
- Toplam / örnek sayısı → 0–100'e ölçekle (min-max veya sigmoid).

**Toplam skor:**
```
skor = scenicScore
     − eğimCezası        (düz: %6 üstü her 100 m için −15; yokuş modunda tırmanış ödül)
     − trafikCezası      (avoidTraffic: ana yol yüzdesi × 0,5)
     − mesafeSapması     (hedeften % sapma × 1)
     + molaBonusu        (amenities: her çeşme/tuvalet +2, max +10)
```
Etiketleme: en yüksek scenicScore → "En manzaralı", en düşük tırmanış → "En düz", en kısa → "En kısa" (çakışırsa sonraki adaya geç).

## Canlı takip
- `Location.startLocationUpdatesAsync` (arka plan task), `accuracy: High`, `distanceInterval: 5`. (İlk taslakta `Balanced` yazıyordu; Balanced iOS'ta ~100 m, Android'de ağ tabanlı konum verir ve 25 m'lik doğruluk filtresi neredeyse tüm noktaları atardı. Pil, 5 m aralık + duraklatınca durdurma + toplu SQLite yazımıyla korunur.)
- Android'de ekran kilitliyken kayıt **ön plan servisi** (bildirimli) ile sürer; ayrı "her zaman" konum izni (`ACCESS_BACKGROUND_LOCATION`) istenmez. iOS'ta "uygulama kullanılırken" izni + `UIBackgroundModes: location`.
- Doğruluğu > 25 m olan noktaları at; basit hareketli ortalama ile yumuşat.
- Noktalar önce SQLite'a yazılır, bitince Supabase'e tek seferde gönderilir.
- Rotaya en yakın nokta mesafesi > 40 m → sapma uyarısı.
- Her 1000 m'de `expo-speech` ile Türkçe bildirim.

## Güvenlik
- RLS: kullanıcı sadece kendi `activities` kaydını yazar; `is_public` rotalar herkese okunur.
- Gizlilik bölgesi kırpması sunucuda (`activities` insert trigger veya Edge Function) yapılır.
- Edge Function'larda kullanıcı JWT doğrulaması ve basit rate limit (kullanıcı başına günde 30 rota üretimi).

## Ölçeklenme notu
ORS ücretsiz kotası dolduğunda: İstanbul OSM extract'ı (Geofabrik) ile GraphHopper'ı küçük bir VPS'te (4 GB RAM yeterli) çalıştır; `src/lib/ors.ts` arayüzünü koruyup sadece adaptörü değiştir.
