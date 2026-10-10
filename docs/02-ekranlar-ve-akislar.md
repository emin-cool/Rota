# 02 — Ekranlar ve kullanıcı akışları

Alt menü 5 sekme: **Harita · Keşfet · Kaydet (+) · Akış · Profil**. Kurslar Profil ve Harita içinden açılır.

| # | Ekran | Faz | İçerik | Stitch referansı |
| --- | --- | --- | --- | --- |
| 1 | Karşılama + Onboarding | MVP | 3 tanıtım; seviye, aktivite, tempo, konum izni | onboarding.html |
| 2 | Giriş / Kayıt | MVP | E-posta, Google, Apple | onboarding.html |
| 3 | Ana Harita | MVP | Tam ekran harita, popüler rotalar, "Rota Oluştur" | home-map.html |
| 4 | Rota Sihirbazı | MVP | 6 adım + ekstralar | wizard.html |
| 5 | Rota Sonuçları | MVP | 3 rota kartı, eğim profili, manzara skoru | results-live-summary.html |
| 6 | Canlı Aktivite | MVP | Süre/mesafe/tempo, mini harita, duraklat/bitir (karanlık tema) | results-live-summary.html |
| 7 | Aktivite Özeti | MVP | Harita, istatistik, fotoğraf, puanla, paylaş | results-live-summary.html |
| 8 | Keşfet | MVP | Filtreli rota listesi + harita görünümü | explore-detail-review.html |
| 9 | Rota Detayı | MVP | Harita, eğim, foto, puan dağılımı, yorumlar | explore-detail-review.html |
| 10 | Yorum Yaz | MVP | Yıldız, etiket, metin, foto | explore-detail-review.html |
| 11 | Profil | MVP | İstatistik, geçmiş, kayıtlı rotalar | feed-profile-courses.html |
| 12 | Ayarlar | MVP | Birimler, ses, gizlilik bölgesi, bildirim | — |
| 13 | Akış | V2 | Takip edilenlerin aktiviteleri | feed-profile-courses.html |
| 14 | Kurslar + Kurs Günü | V2 | Program listesi, günlük antrenman | feed-profile-courses.html |
| 15 | Etkinlikler | V2 | Grup koşuları, katıl | — |

## Akışlar

**Akış A — "1 saat yürüyeceğim":**
Harita → Rota Oluştur → Yürüyüş → Dönüşlü → Mevcut konum → 1 sa → Sahil + Düz → Ekstralar → Sonuçlar (3 rota) → Başla → Canlı takip → Bitir → Özet → Puanla.

**Akış B — Popüler rota:**
Keşfet → Filtre (Yürüyüş, ≤ 1 sa, 4+ ★) → "Emirgan Sahil Yürüyüşü" → Rota detayı → "Başlangıca yol tarifi" → Rotayı Başlat → Bitir → Yorum yaz.

**Akış C — Kurs:**
Kurslar → "0'dan 5K'ya" → Katıl → Hafta 1 Gün 1 → "Bu antrenman için rota bul" (sihirbaz 30 dk + düz açılır) → Başla (sesli aralıklar) → Gün tamamlandı.

## Her ekranda olması gerekenler
- Loading (iskelet/skeleton), boş durum ("Yakında rota yok — ilkini sen oluştur"), hata durumu (tekrar dene butonu)
- Konum izni yoksa açıklayıcı kart + ayarlara git butonu
- İnternet yoksa üst banner
