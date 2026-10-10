# 05 — Kurulum, yol haritası, gelir modeli, riskler

## Windows kurulumu (bir kez, ~45 dk)
Komutlar zamanla değişebilir; takılırsan resmi dokümana bak.

1. **Node.js LTS** (nodejs.org) → kontrol: `node -v`
2. **Git for Windows** (git-scm.com) — Claude Code Git Bash kullanır.
3. **Claude Code**: PowerShell'de `irm https://claude.ai/install.ps1 | iex` → `claude` yazıp giriş yap.
4. **VS Code** + ESLint, Prettier, Tailwind CSS IntelliSense eklentileri.
5. **Expo**: expo.dev'de hesap aç → `npm i -g eas-cli` → `eas login`
6. **Telefonda test**:
   - Başta Expo Go yeterli.
   - Mapbox native modül olduğu için development build gerekir: `eas build --profile development --platform ios` (Apple Developer hesabı, 99 USD/yıl) veya Android: `eas build --profile development --platform android` (ücretsiz, APK'yı telefona kur).
   - Öneri: Apple hesabı açılana kadar Android emülatörü (Android Studio) veya bir Android telefonla ilerle.
7. **Servisler**:
   - Supabase: yeni proje → Database → Extensions → `postgis` aç; Supabase CLI: `npm i -g supabase` (veya `scoop install supabase`)
   - Mapbox: public token `pk.…` ve indirme token'ı `sk.…` (Downloads:Read yetkili)
   - OpenRouteService: openrouteservice.org'dan ücretsiz anahtar
8. `.env.example` → `.env` kopyala, doldur. ORS anahtarını Supabase secret yap: `supabase secrets set ORS_API_KEY=...`

## Takvim (haftada ~15 saat varsayımı)

| Hafta | İş | Çıktı |
| --- | --- | --- |
| 1 | Stitch tasarımları + kurulum | Ekran tasarımları, boş uygulama çalışıyor |
| 2 | P0.1, P0.2, P1.1 | Giriş + ana harita |
| 3–4 | P1.2, P1.3 | Rota sihirbazı ve üretimi |
| 5 | P1.4, P1.5 | Canlı takip + kayıt |
| 6 | P1.6, P1.7 | Keşfet, detay, yorum, 30 seed rota |
| 7 | P1.8 + kapalı test | 20–30 kişilik test |
| 8–11 | P2.1–P2.3 | Sosyal, kurslar, ekstralar |
| 12 | P3.1 | Mağaza yayını |

## Gelir modeli
- **Ücretsiz:** günde 5 rota üretimi, popüler rotalar, takip, temel kurslar
- **Premium (örnek: aylık ~99 TL / yıllık ~799 TL):** sınırsız rota, gelişmiş filtreler, offline harita, detaylı analiz, tüm kurslar, reklamsız
- **Eğitmen marketplace:** ücretli kurslardan %20 komisyon
- **Yerel iş birlikleri:** etiketli sponsorlu mola noktaları

Fiyatları yayından önce rakiplere göre güncelle.

## Maliyetler
Apple Developer 99 USD/yıl, Google Play 25 USD tek seferlik. Supabase, Mapbox, ORS ücretsiz katmanları MVP ve ilk birkaç yüz kullanıcı için genelde yeterli; kotaları kontrol et.

## Riskler ve önlemler
- **Boş uygulama:** ilk 30 rotayı fotoğraflarıyla sen doldur; ilk 100 kullanıcıyı üniversite koşu/bisiklet toplulukları ve kulüplerden topla.
- **ORS kota/latency:** önbellek; büyüyünce kendi GraphHopper sunucun.
- **İstanbul eğimi:** "Düz" filtresini gerçek yokuşlarda (Cihangir, Beşiktaş) test et.
- **GPS ve batarya:** `Balanced` doğruluk, ekran kapalıyken seyrek güncelleme.
- **KVKK:** gizlilik bölgesi varsayılan açık, aktiviteler varsayılan "takipçiler", hesap ve veri silme zorunlu.
- **Mağaza reddi:** arka plan konum gerekçesini net yaz; uygulama içi hesap silme.

## İlk 3 ay başarı kriteri
500 kayıtlı kullanıcı, haftalık aktif oran %30, rota başına ortalama 5+ yorum, kurs tamamlama %25.
