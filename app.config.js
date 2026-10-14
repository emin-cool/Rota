// app.json'ı dinamik tamamlar: Android FCM (push) için google-services.json repoya KONMAZ (repo herkese açık);
// EAS'ta "dosya" türünde ortam değişkeni olarak yüklenir: `eas env:create --name GOOGLE_SERVICES_JSON --type file ...`
// (docs/07-test-ve-yayin.md §6). Değişken yoksa (ör. yerel geliştirme) bu alan boş kalır.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
});
