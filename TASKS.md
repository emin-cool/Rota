# TASKS — İlerleme listesi

Claude Code her adımı bitirince ilgili maddeyi `[x]` yapar. Promptlar: `prompts/claude-code/`.

## Hazırlık
- [ ] Windows kurulumu tamam (Node, Git, Claude Code, Expo, EAS)
- [ ] Supabase projesi + PostGIS açık
- [ ] Mapbox ve ORS anahtarları `.env` içinde
- [ ] Stitch tasarımları `design/stitch/` içinde

## Faz 0 — İskelet
- [x] P0.1 Proje kurulumu, sekmeler, tema token'ları
- [x] P0.2 Supabase, migration'lar, auth, onboarding (kod hazır; migration push + uçtan uca test Supabase projesi bağlanınca — docs/06-supabase-kurulum.md)

## Faz 1 — MVP
- [x] P1.1 Ana harita (tablette development build ile doğrulandı; örnek rotalar supabase/seed.sql)
- [x] P1.2 `generate-routes` Edge Function (OSM verisi kendi PostGIS tablomuzda: scripts/osm-import.mjs; ORS secret + db push + import + deploy sırası docs/06-supabase-kurulum.md)
- [x] P1.3 Rota sihirbazı + sonuç ekranı (kod hazır; yeni development build (react-native-svg) kurulup tablette doğrulanacak)
- [x] P1.4 Canlı aktivite takibi (kod hazır; yeni development build kurulup dışarıda 10 dk yürüyüşle doğrulanacak)
- [x] P1.5 Aktivite özeti + kaydetme (kod hazır; `db:push`, yeni development build ve tablette doğrulama bekliyor — docs/06-supabase-kurulum.md)
- [x] P1.6 Keşfet + rota detayı + yorum (kod ve RPC'ler hazır; migration'lar uygulandı; tablette doğrulama bekliyor — yeni native modül yok, development build gerekmez)
- [x] P1.7 Profil, ayarlar, gizlilik bölgesi, hesabı sil (tablette doğrulandı; 30 seed rota hariç — aşağıdaki "Bekleyen küçük işler" maddesine bak)
- [x] P1.8 Genel kontrol ve temizlik (rapor + düzeltmeler; Sentry kodu hazır, DSN ve yeni build bekliyor — docs/07-test-ve-yayin.md)
- [ ] Kapalı test (20–30 kişi)

## Faz 2 — Sosyal ve Kurslar
- [x] P2.1a Takip (gizli hesap istekleri), akış, alkış, yorum, kişi arama, başkasının profili, rota paylaşma (sunucu kuralları test-rls 85/85; tablette doğrulama bekliyor)
- [ ] P2.1b Push bildirimleri (yeni takipçi, alkış, yorum) + öne çıkan rota otomasyonu (pg_cron)
- [ ] P2.1c Engelle / bildir (moderasyon): dış testçilere ve mağazaya açmadan ÖNCE (Apple kullanıcı içeriği şartı)
- [ ] P2.2 Kurslar ve sesli aralık yönlendirme
- [ ] P2.3 Etkinlikler, meydan okumalar, hava durumu, segmentler, canlı konum paylaşımı

## Faz 3 — Yayın
- [ ] P3.1 Mağaza hazırlığı ve yayın

## Bekleyen küçük işler
- [x] **OSM verisi: kalan 22 karoyu yükle** (120/120 karo tamamlandı, 2026-10-13) (en kuzey şerit 41.20–41.25 ve kuzeydoğu köşesi; Karadeniz kıyısı/orman). Overpass düzelince: `node scripts/osm-import.mjs` (kaldığı yerden devam eder). Şehir çekirdeği (Boğaz'ın iki yakası) tamam, Emirgan dahil. Not: Overpass bazen tamamen yanıt vermiyor, o zaman birkaç saat sonra tekrar dene.
- [ ] **P1.4 saha testi (dışarıda):** gerçek yürüyüşte 10 dk, ekran kilitliyken mesafe artıyor mu, bildirim kalıyor mu, 1 km'de sesli bildirim, GPS kalite rozeti, rotadan sapma uyarısı (40 m). Masa testleri (simülasyon) ayrıca yapıldı.
- [x] **30 seed rota** yazıldı (2026-10-14): 14 yürüyüş, 7 koşu, 9 bisiklet; hepsi `is_featured`, puansız, yükseklik profilli. Yeniden çalıştırmak için `node scripts/seed-routes.mjs` (aynı başlıklı rotalar güncellenir, yorumlar korunur).
- [ ] **Sentry hesabı + DSN:** docs/07-test-ve-yayin.md §1. `.env`'e `EXPO_PUBLIC_SENTRY_DSN`, `node scripts/eas-env-push.mjs`, yeni build (Sentry native modül), Ayarlar başlığına uzun basarak test hatası.
- [ ] **Kapalı test build'leri:** Android APK (`preview`) ve iOS TestFlight (docs/07-test-ve-yayin.md §2–3).
- [ ] **HERKESE AÇIK YAYINDAN ÖNCE: fotoğraf/avatar depolarını imzalı adrese çevir** (bucket özel + `createSignedUrls`; docs/07-test-ve-yayin.md §5). Ayrıca gizlilik politikası, paylaşım görselinde gizlilik bölgesi kırpması, mağaza beyanları.
