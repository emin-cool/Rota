# 07 — Kapalı test, hata izleme ve yayın

Bu belge P1.8 sonrası kapalı test (20–30 kişi) ve herkese açık yayın öncesi yapılacakları toplar.

## 1. Hata izleme (Sentry) kurulumu — bir kez

Kod hazır (`src/lib/monitoring.ts`). DSN yoksa ya da geliştirme modundaysa hiçbir şey göndermez.

1. https://sentry.io → ücretsiz hesap aç (Developer planı yeter) → organizasyon oluştur.
2. **Create Project** → platform **React Native** → ad: `rota` → **Create**.
3. Açılan sayfadaki **DSN**'i kopyala (`https://…@o….ingest.sentry.io/…`). Gizli değildir ama sohbete/commit'e yazma.
4. `.env` dosyasına ekle: `EXPO_PUBLIC_SENTRY_DSN=<dsn>`
5. EAS'a yükle: `node scripts/eas-env-push.mjs`
6. Yeni build al (Sentry native modül içerir → development build de yenilenmeli):
   `npx eas-cli build --profile preview --platform android` (kapalı test) ya da `--profile development` (cihazda geliştirme).
7. **Doğrula:** preview/production derlemesinde Ayarlar → başlığa 1,5 sn basılı tut → "Test hatası gönderildi" çıkar; birkaç dakika içinde Sentry → Issues'ta `Sentry testi` görünmeli. (Geliştirme modunda hata izleme bilerek kapalıdır.)

**Okunabilir hata izleri (kaynak haritası) — isteğe bağlı ama önerilir:** Sentry → Settings → Auth Tokens → yeni token
(izinler: `project:releases`, `org:read`). Token'ı EAS secret yap:
`npx eas-cli env:create --name SENTRY_AUTH_TOKEN --value <token> --visibility secret --environment preview --environment production`.
`app.json` içindeki `"@sentry/react-native"` eklentisine `{ "organization": "<org-slug>", "project": "rota" }` seçeneklerini ver ve
`eas.json` içindeki `SENTRY_DISABLE_AUTO_UPLOAD` satırlarını kaldır. Yapılmazsa hata izleri küçültülmüş (okunması zor) görünür.

**Gizlilik:** IP/e-posta toplanmaz, kullanıcı yalnızca rastgele kimliğiyle işaretlenir, ağ adreslerindeki sorgu parametreleri
silinir, performans izleme kapalı. Gizlilik politikasına "çökme ve hata raporları (Sentry)" eklenmeli.

## 2. Kapalı test — Android (APK)

```bash
node scripts/eas-env-push.mjs                                  # .env → EAS ortam değişkenleri (değişince)
npx eas-cli build --profile preview --platform android         # uygulama içinde JS gömülüdür, Metro gerekmez
```

Build bitince EAS bir indirme bağlantısı ve QR verir; testçilere gönder. Telefonda "bilinmeyen kaynaklardan yükleme" izni gerekir.
Güncelleme: yeni build al, bağlantıyı yeniden gönder. Daha düzgün yol: Google Play Console (25 USD, tek sefer) → **dahili test** kanalı.

## 3. Kapalı test — iOS (TestFlight)

Gereken: Apple Developer hesabı (var). iOS bundle kimliği: `com.eminkal.rota` (`com.rota.app` Apple'da başkasına ait çıktı; Android paketi şimdilik `com.rota.app`, Play Store öncesi benzersizliği kontrol edilmeli).

1. **İlk build (etkileşimli, bir kez):** `npx eas-cli build --platform ios --profile production` — Apple ID ile giriş ister; sertifika,
   provisioning profili ve App ID'yi EAS oluşturur. Yetenekler: Sign in with Apple (app.json'da var), arka plan konumu (eklentiyle).
2. **App Store Connect'te uygulama kaydı oluştur:** Apps → + → New App → ad **Rota**, bundle ID `com.eminkal.rota`, SKU serbest.
3. **Yükle:** `npx eas-cli submit --platform ios --profile production --latest` (ilk seferde Apple girişi ve uygulamayı seçmen istenir).
4. **TestFlight:** build birkaç dakika işlenir. *İç test* (App Store Connect kullanıcıları, 100 kişiye kadar) incelemesiz; *dış test*
   (10.000 kişiye kadar, herkese bağlantı/e-posta) ilk build için Beta App Review ister (genelde 1–2 gün).
5. Şifreleme sorusu çıkmasın diye `ITSAppUsesNonExemptEncryption: false` app.json'a eklendi.

**iOS'ta kontrol et:**
- Supabase → Authentication → Providers → **Apple**: Client ID listesine `com.eminkal.rota` ekli mi? (eski `com.rota.app` kalabilir, virgülle ayır) (Native Apple girişi buna bağlı.)
- Konum izni açıklamaları (Türkçe) app.json'da; arka plan konum için App Store incelemesinde "neden" sorulur (aktivite kaydı).
- Hesabı silme zorunluluğu karşılandı (Ayarlar → Hesabımı sil).

## 3b. Anında güncelleme (EAS Update) — sık test için

`expo-updates` kurulu: JS/TS ve görsel değişiklikler **yeni build ve TestFlight yüklemesi beklemeden** telefona gider.
Kanallar: `development`, `preview` (Android APK), `production` (iOS TestFlight ve mağaza). Bu kuruluma geçişte **bir kez** yeni build gerekir.

```bash
# JS/TS değişikliği (ekran, mantık, metin, stil): iOS TestFlight kullanıcılarına
npx eas-cli update --channel production --environment production --message "ne değişti"
# Android APK (preview) kullanıcılarına
npx eas-cli update --channel preview --environment production --message "ne değişti"
```
Uygulama açılışta güncellemeyi arka planda indirir; **bir sonraki açılışta** (tamamen kapatıp aç) devreye girer.

**Kural (önemli):** Native modül eklenir/çıkarılırsa, `app.json` eklentileri/izinleri/ikon değişirse **yeni build al ve `app.json` içindeki `version`'ı artır**
(`1.0.0` → `1.0.1`). Güncellemeler yalnızca aynı `version` taşıyan build'lere gider (`runtimeVersion: appVersion`); artırmazsan eski build
yeni JS'i alır ama eksik native modül yüzünden çöker.
Geri alma: `npx eas-cli update:rollback --channel production` (önceki güncellemeye döner).
`EXPO_PUBLIC_*` değerleri güncelleme paketlenirken `--environment production` ile EAS'tan alınır.

## 4. Kapalı testten önce hızlı kontrol listesi
- [ ] `npx tsc --noEmit`, `npx eslint .`, `npx jest`, `node scripts/test-rls.mjs` yeşil
- [ ] Sentry DSN'i EAS'ta ve test hatası Sentry'de görünüyor
- [ ] Gerçek yürüyüş saha testi (P1.4): ekran kilitliyken kayıt, 1 km sesli bildirim, GPS rozeti, sapma uyarısı, pil
- [ ] 30 seed rota Keşfet ve haritada görünüyor
- [ ] Test hesabıyla hesap silme

## 4b. Kullanıcı içeriği moderasyonu (Apple 1.2) — dış test ve mağaza öncesi

Uygulamada kullanıcı içeriği var (yorum, aktivite notu, fotoğraf, profil adı). Apple şunları ister; durumları:

| Şart | Durum |
|---|---|
| İçeriği/kullanıcıyı **bildirme** | ✅ "⋯" menüsü (aktivite, yorum, rota yorumu, profil); sebep + isteğe bağlı açıklama |
| Kullanıcıyı **engelleme** | ✅ iki yönlü gizleme, takip kopar; Ayarlar → Engellenen kullanıcılar |
| Bildirimlere **24 saat içinde müdahale** | ⚠️ süreç sende: Supabase → Table Editor → `reports` (status = open). İncelenince `status`'u `reviewed/actioned/dismissed` yap. İçeriği silmek için ilgili tablodan satırı sil (yorum: `comments`, aktivite: `activities`), kullanıcıyı kalıcı uzaklaştırmak için Authentication → Users → sil |
| **Kullanım koşulları** (EULA) — uygunsuz içeriğe hoşgörü yok maddesi | ✅ `docs/legal/kullanim-kosullari.html`; kayıt ekranında ve Ayarlar'da bağlantı (`src/lib/legal.ts`). **Yayın:** GitHub → Settings → Pages → Branch `main`, klasör `/docs` → adres `https://emin-cool.github.io/Rota/legal/` |
| **Gizlilik politikası** | ✅ `docs/legal/gizlilik-politikasi.html` (konum, fotoğraf, Sentry, hesap silme, gizlilik bölgesi, KVKK) |
| Mağaza formunda **iletişim bilgisi** | ✅ geçici: abdullahkal887@gmail.com (`src/lib/legal.ts` + `docs/legal/*.html`). rota.info adresi açılınca üç yerde değiştir |

### Rapor e-postası (notify-report)
Yeni `reports` satırı → Database Webhook → Edge Function `notify-report` → Resend e-postası. Kurulum (bir kez):
1. resend.com'da, **abdullahkal887@gmail.com ile** hesap aç (ücretsiz plan; alan adı doğrulaması olmadan yalnızca hesap sahibinin adresine gönderilir). API Keys → anahtar oluştur.
2. Secret'lar (değerleri sohbete yazma): `npx supabase secrets set RESEND_API_KEY=... REPORT_WEBHOOK_SECRET=<uzun rastgele metin> REPORT_NOTIFY_EMAIL=abdullahkal887@gmail.com`
3. `npx supabase functions deploy notify-report --use-api --no-verify-jwt`
4. Supabase → Database → Webhooks → Create: tablo `reports`, olay **Insert**, tür HTTP Request (POST), URL `https://<proje-ref>.supabase.co/functions/v1/notify-report`, header `x-webhook-secret: <aynı secret>`.
5. Test: uygulamadan bir içeriği bildir → e-posta gelmeli (spam klasörüne de bak).

## 5. Herkese açık yayından ÖNCE yapılacaklar (kapalı testte gerek yok)
- [ ] **Fotoğraf ve avatar depolarını imzalı adrese çevir (C maddesi).** Şu an `route-photos` ve `avatars` bucket'ları herkese açık okuma; yollar
      tahmin edilemez UUID ama adresi bilen herkes görür (özel rotadaki fotoğraf dahil). Yapılacak: bucket'ı özel yap, SELECT politikasını
      `can_see_route` / sahibi koşuluna bağla, istemci `createSignedUrl` kullansın (rota detayında fotoğraf başına ek istek → toplu `createSignedUrls`),
      `route_photos.url` yerine dosya yolunu sakla (migration + mevcut kayıtları dönüştür).
- [x] Gizlilik politikası ve kullanım koşulları (URL) — yazıldı (§4b); Pages'i açınca mağaza formlarına bu adresler girilecek
- [ ] Android arka plan konum ve ön plan servisi beyanı (Play Console), iOS arka plan konum gerekçesi
- [ ] Paylaşım görselindeki yolun gizlilik bölgesine göre kırpılması (şu an kırpma yalnızca sunucuda)
- [ ] "Takipçiler" görünürlüğü `follows` tablosu (P2.1) ile gerçek hale gelsin
- [ ] Mağaza görselleri, açıklama, yaş derecelendirmesi
