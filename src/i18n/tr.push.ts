/** Push bildirimleri (P2.1b). */
export const trPush = {
  push: {
    askTitle: 'Bildirimleri açalım mı?',
    askBody:
      'Yeni takipçiler, alkışlar ve yorumlar için haber verelim. Bunu Ayarlar’dan değiştirebilirsin.',
    askLater: 'Şimdi değil',
    askAllow: 'İzin ver',
    settings: {
      section: 'Bildirimler',
      permissionOff: 'Bildirimler kapalı',
      permissionOffHint: 'Bildirim almak için izin ver.',
      permissionDenied: 'Bildirimlere izin verilmedi',
      permissionDeniedHint: 'Telefonun ayarlarından Rota için bildirimleri aç.',
      allow: 'Bildirimlere izin ver',
      openSettings: 'Ayarları aç',
      follows: 'Takip',
      followsHint: 'Yeni takipçi, takip isteği ve kabul',
      kudos: 'Alkış',
      kudosHint: 'Aktivitene alkış gelince',
      comments: 'Yorum',
      commentsHint: 'Aktivitene yorum yapılınca',
      loadError: 'Bildirim ayarları yüklenemedi.',
      saveError: 'Ayar kaydedilemedi. Tekrar dene.',
      unavailable: 'Bildirimler bu cihazda kullanılamıyor.',
    },
  },
} as const;
