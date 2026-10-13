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
- [ ] P1.8 Genel kontrol ve temizlik
- [ ] Kapalı test (20–30 kişi)

## Faz 2 — Sosyal ve Kurslar
- [ ] P2.1 Takip, akış, alkış, yorum, rota paylaşma
- [ ] P2.2 Kurslar ve sesli aralık yönlendirme
- [ ] P2.3 Etkinlikler, meydan okumalar, hava durumu, segmentler, canlı konum paylaşımı

## Faz 3 — Yayın
- [ ] P3.1 Mağaza hazırlığı ve yayın

## Bekleyen küçük işler
- [x] **OSM verisi: kalan 22 karoyu yükle** (120/120 karo tamamlandı, 2026-10-13) (en kuzey şerit 41.20–41.25 ve kuzeydoğu köşesi; Karadeniz kıyısı/orman). Overpass düzelince: `node scripts/osm-import.mjs` (kaldığı yerden devam eder). Şehir çekirdeği (Boğaz'ın iki yakası) tamam, Emirgan dahil. Not: Overpass bazen tamamen yanıt vermiyor, o zaman birkaç saat sonra tekrar dene.
- [ ] **P1.4 saha testi (dışarıda):** gerçek yürüyüşte 10 dk, ekran kilitliyken mesafe artıyor mu, bildirim kalıyor mu, 1 km'de sesli bildirim, GPS kalite rozeti, rotadan sapma uyarısı (40 m). Masa testleri (simülasyon) ayrıca yapıldı.
- [ ] **30 seed rota: seed'i çalıştır** — OpenRouteService yürüyüş (`foot-walking`) ve bisiklet (`cycling-regular`) servisleri 2026-10-14'te yanıt vermiyordu (anahtar geçerli, `driving-car` çalışıyor). ORS açılınca: önce `node scripts/seed-routes.mjs --check` (hiçbir şey yazmaz; noktaların yola oturup oturmadığını ve Belgrad Ormanı rotalarının mesafesini gösterir, 6,5 km parkuru ayarlanmalı), sonra `node scripts/seed-routes.mjs`. Script ayrıntıları dosya başındaki yorumda. Eski 5 "ÖRNEK VERİ" rotası seed ile silinir.
