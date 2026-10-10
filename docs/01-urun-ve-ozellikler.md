# 01 — Ürün ve özellikler

## Ürün özeti
**Rota**, harita merkezli bir spor sosyal medyasıdır. Kullanıcı birkaç soruyu cevaplar, uygulama ona yürüyüş, koşu veya bisiklet rotası çıkarır. Diğer kullanıcıların puanladığı popüler rotaları keşfeder, yeni başlayanlar kurslarla düzenli spor alışkanlığı kazanır.

**Hedef kitle:** Şehirde yürüyüş/koşu/bisiklete yeni başlayanlar (18–40, ilk hedef İstanbul); "bugün nereye gitsem?" diyen düzenli sporcular; grup halinde spor yapmak isteyenler.

**Farkımız:** Strava performans, Komoot doğa turu, AllTrails patika odaklı. Rota ise şehir içi, yerel ve yeni başlayan dostu: soru-cevaplı rota sihirbazı, kurs + rota entegrasyonu, İstanbul'a özel içerik (sahil, Boğaz, vapur/metro ile dönüş).

**Ana metrikler:** haftalık aktif kullanıcı, kullanıcı başına haftalık aktivite, rota başına yorum, kurs tamamlama oranı.

---

## 2.1 Akıllı Rota Sihirbazı (MVP)
Sorular sırasıyla:
1. **Aktivite:** Yürüyüş / Koşu / Bisiklet
2. **Rota tipi:** Dönüşlü (loop) / A → B / Git-dön
3. **Başlangıç:** Mevcut konum veya haritadan seçim; A → B ise bitiş noktası
4. **Hedef:** Süre (30 dk, 45 dk, 1 sa, 1,5 sa, özel) veya mesafe (km)
5. **Manzara (çoklu):** Sahil / Park-yeşil / Tarihi doku / Fark etmez — **Eğim:** Düz / Biraz eğim olabilir / Yokuş antrenmanı
6. **Ekstralar:**
   - Zemin: Asfalt / Toprak-patika / Fark etmez
   - Trafikten uzak dur
   - Aydınlık ve kalabalık yollar (akşam güvenliği)
   - Mola noktaları: çeşme, tuvalet, kafe, bank
   - Bitişte toplu taşıma durağı öner (A → B)
   - Köpekle yürüyüş (park önceliği)
   - Bebek arabası / tekerlekli sandalye uygun
   - Bisiklet yolu önceliği (bisiklette)

**Süre → mesafe:** yürüyüş 4,8 km/s, koşu kullanıcı temposu (varsayılan 6:30 dk/km), bisiklet 16 km/s; her 10 m tırmanış +1 dk. Örnek: 1 saatlik dönüşlü yürüyüş → hedef 4,8 km, kabul aralığı 4,3–5,3 km.

**Sonuç ekranı:** 3 alternatif rota kartı ("En manzaralı", "En düz", "En kısa"): mesafe, süre, tırmanış, manzara skoru (0–100), eğim profili, mola noktası ikonları. Butonlar: Başla, Kaydet, Paylaş.

## 2.2 Canlı Aktivite Takibi (MVP)
- GPS ile süre, mesafe, anlık/ortalama tempo, tırmanış
- Her km'de Türkçe sesli bildirim (tempo + kalan mesafe)
- Rotadan sapma uyarısı (40 m) ve yeniden rota
- Duraklat / devam / bitir; arka planda ve kilit ekranında çalışır
- Bitince özet: harita, istatistik, fotoğraf, rotayı puanla

## 2.3 Popüler Rotalar (MVP)
- Keşfet: yakındaki rotalar (harita + liste)
- Filtre: aktivite, süre, mesafe, zorluk, ilçe, min. puan
- Rota detayı: harita, eğim grafiği, fotoğraflar, puan dağılımı, yorumlar
- Yorum: 1–5 yıldız + metin + etiketler ("Gün batımında harika", "Akşam kalabalık", "Bisiklet yolu kesintili", "Gölge az")
- Yorum için rotayı tamamlamış olmak gerekir → "Doğrulanmış" rozeti
- Başlangıç: 30 editör rotası (Emirgan sahil, Bebek–Arnavutköy, Taksim → Kabataş, Moda sahili, Caddebostan bisiklet, Belgrad Ormanı vb.)

## 2.4 Sosyal Katman (V2)
- Profil: toplam km, aktivite, rozetler, favori rotalar
- Takip + akış, alkış (kudos), yorum
- Kendi rotanı paylaş; puan ≥ 4,3 ve ≥ 20 tamamlanma → "Popüler"
- Segment liderlik tabloları (haftalık / tüm zamanlar)
- Gizlilik bölgesi: ev/iş çevresinde ilk/son 200 m gizlenir (varsayılan açık)

## 2.5 Kurslar (V2)
- Ücretsiz programlar: "0'dan 5K'ya 8 hafta", "30 Günlük Yürüyüş Alışkanlığı", "Şehirde Güvenli Bisiklet", "10K'ya Hazırlık"
- Her gün bir antrenman kartı (ör. 5 dk ısınma + 6×(1 dk koşu, 2 dk yürüyüş) + 5 dk soğuma)
- "Bu antrenman için rota bul" → sihirbaz süre + düz eğim seçili açılır
- Canlı takipte sesli aralık yönlendirme ("Şimdi koş!", "Yürüyüşe geç")
- İlerleme, hatırlatıcı bildirim, bitirme rozeti

## 2.6 Ekstralar (V2–V3)
- **Grup etkinlikleri (V2):** rota + tarih + seviye, katıl, sohbet
- **Meydan okumalar (V2):** "Ekimde 50 km", "Boğaz'ın 5 sahil rotası"
- **Hava durumu (V2):** yağmur/sıcaklık uyarısı, en uygun saat önerisi
- **Apple Health / Health Connect (V2)**
- **Güvenlik (V2):** canlı konumu güvenilen kişiyle paylaş, acil durum butonu
- **Offline harita (V3, premium)**
- **Eğitmen marketplace (V3):** ücretli kurslar, %20 komisyon
- **Akıllı saat (V3):** Apple Watch / Wear OS
- **AI koç (V3):** geçmişe göre haftalık plan
