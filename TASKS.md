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
- [ ] P1.2 `generate-routes` Edge Function
- [ ] P1.3 Rota sihirbazı + sonuç ekranı
- [ ] P1.4 Canlı aktivite takibi
- [ ] P1.5 Aktivite özeti + kaydetme
- [ ] P1.6 Keşfet + rota detayı + yorum
- [ ] P1.7 Profil, ayarlar, 30 seed rota
- [ ] P1.8 Genel kontrol ve temizlik
- [ ] Kapalı test (20–30 kişi)

## Faz 2 — Sosyal ve Kurslar
- [ ] P2.1 Takip, akış, alkış, yorum, rota paylaşma
- [ ] P2.2 Kurslar ve sesli aralık yönlendirme
- [ ] P2.3 Etkinlikler, meydan okumalar, hava durumu, segmentler, canlı konum paylaşımı

## Faz 3 — Yayın
- [ ] P3.1 Mağaza hazırlığı ve yayın
