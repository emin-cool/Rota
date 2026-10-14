import { Linking } from 'react-native';

// Yasal sayfalar GitHub Pages'te (docs/legal). Alan adı değişirse yalnızca burayı güncelle.
const LEGAL_BASE_URL = 'https://emin-cool.github.io/Rota/legal';

export const TERMS_URL = `${LEGAL_BASE_URL}/kullanim-kosullari.html`;
export const PRIVACY_URL = `${LEGAL_BASE_URL}/gizlilik-politikasi.html`;
export const SUPPORT_EMAIL = 'abdullahkal887@gmail.com';

export function openLegalUrl(url: string): void {
  void Linking.openURL(url).catch(() => undefined);
}

export function openSupportMail(): void {
  void Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => undefined);
}
