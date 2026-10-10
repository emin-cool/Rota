/** Arayüz metinleri (Türkçe). İleride çok dil için `en.ts` ile aynı şekli taşıyacak. */
export const tr = {
  tabs: {
    map: 'Harita',
    explore: 'Keşfet',
    record: 'Kaydet',
    feed: 'Akış',
    profile: 'Profil',
  },
  common: {
    loading: 'Yükleniyor…',
    retry: 'Tekrar dene',
    close: 'Kapat',
  },
} as const;

export type Translations = typeof tr;
