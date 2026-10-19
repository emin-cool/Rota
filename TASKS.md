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
- [x] P2.1b Push bildirimleri (takip, alkış, yorum) + öne çıkan rota otomasyonu (pg_cron): iOS (TestFlight 1.1.0 (3)) ve Android (APK 1.1.0) gerçek cihazlarda doğrulandı (14 Ekim 2026). Dokununca yönlendirme ve Ayarlar anahtarları ayrıca teyit edilebilir.
- [x] P2.1c Engelle / bildir (iki yönlü engel, bildirme, engellenenler listesi; test-rls 118/118; tablette doğrulama bekliyor). Dış testçi/mağaza öncesi ayrıca: kullanım koşulları URL'si, `reports` tablosuna bakma süreci (docs/07 §4b)
- [x] P2.2a Kurslar: katalog (4 ücretsiz program), kurs detayı, antrenman günü, katıl/ayrıl, "bu antrenman için rota bul", gün→aktivite bağı ve otomatik tamamlama (`db:push` + `test-rls` geçti, `eas update` ile yayında, cihazda uçtan uca doğrulandı — 15 Ekim 2026)
- [x] P2.2b Sesli aralık yönlendirme (canlı takipte "Şimdi koş!" / "Yürüyüşe geç", faz şeridi): `eas update` ile yayında, cihazda doğrulandı (16 Ekim 2026)
- [ ] P2.2c Kurs hatırlatıcı bildirimi, bitirme rozeti
- [x] Hava durumu (P2.3'ün parçası): Edge Function `weather` (Open-Meteo, önbellekli), harita çipi + ayrıntı sayfası, uyarılar, aktiviteye göre en uygun saat, sihirbaz uyarı kartı, antrenman günü ipucu (kod hazır; `db:push`, `weather` deploy ve cihazda doğrulama bekliyor). **Yayın öncesi: Open-Meteo ticari lisans/sağlayıcı kararı.**
- [ ] P2.3 kalan: etkinlikler, meydan okumalar, segmentler, canlı konum paylaşımı

## Faz 3 — Yayın
- [ ] P3.1 Mağaza hazırlığı ve yayın

## Bekleyen küçük işler
- [x] **OSM verisi: kalan 22 karoyu yükle** (120/120 karo tamamlandı, 2026-10-13) (en kuzey şerit 41.20–41.25 ve kuzeydoğu köşesi; Karadeniz kıyısı/orman). Overpass düzelince: `node scripts/osm-import.mjs` (kaldığı yerden devam eder). Şehir çekirdeği (Boğaz'ın iki yakası) tamam, Emirgan dahil. Not: Overpass bazen tamamen yanıt vermiyor, o zaman birkaç saat sonra tekrar dene.
- [ ] **P1.4 saha testi (dışarıda):** gerçek yürüyüşte 10 dk, ekran kilitliyken mesafe artıyor mu, bildirim kalıyor mu, 1 km'de sesli bildirim, GPS kalite rozeti, rotadan sapma uyarısı (40 m). Masa testleri (simülasyon) ayrıca yapıldı.
- [x] **30 seed rota** yazıldı (2026-10-14): 14 yürüyüş, 7 koşu, 9 bisiklet; hepsi `is_featured`, puansız, yükseklik profilli. Yeniden çalıştırmak için `node scripts/seed-routes.mjs` (aynı başlıklı rotalar güncellenir, yorumlar korunur).
- [ ] **Sentry hesabı + DSN:** docs/07-test-ve-yayin.md §1. `.env`'e `EXPO_PUBLIC_SENTRY_DSN`, `node scripts/eas-env-push.mjs`, yeni build (Sentry native modül), Ayarlar başlığına uzun basarak test hatası.
- [ ] **Kapalı test build'leri:** Android APK (`preview`) ve iOS TestFlight (docs/07-test-ve-yayin.md §2–3).
- [ ] **HERKESE AÇIK YAYINDAN ÖNCE: fotoğraf/avatar depolarını imzalı adrese çevir** (bucket özel + `createSignedUrls`; docs/07-test-ve-yayin.md §5). Ayrıca gizlilik politikası, paylaşım görselinde gizlilik bölgesi kırpması, mağaza beyanları.
- [ ] Dış test öncesi: kullanım koşulları + gizlilik politikası yazıldı (docs/legal); GitHub Pages açılacak, `notify-report` kurulacak (docs/07 §4b)
- [x] Canlı takip: harita ön planda, rotalı kayıtta rota yönüne dönük (3B / düz / kuzey), altta tempo·mesafe·süre şeridi + yukarı çekilen detay çekmecesi (cihazda doğrulama bekliyor: dışarıda yürüyüş)
- [ ] **HERKESE AÇIK YAYINDAN ÖNCE: Supabase 'Confirm email' tekrar aç** (önce Resend SMTP + alan adı; docs/07 §5)
