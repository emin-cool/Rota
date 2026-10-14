/** Arayüz metinleri (Türkçe). İleride çok dil için `en.ts` ile aynı şekli taşıyacak. */
import { trCourses } from './tr.courses';
import { trExplore } from './tr.explore';
import { trLive } from './tr.live';
import { trModeration } from './tr.moderation';
import { trProfile } from './tr.profile';
import { trPush } from './tr.push';
import { trSocial } from './tr.social';
import { trWizard } from './tr.wizard';

export const tr = {
  ...trWizard,
  ...trCourses,
  ...trLive,
  ...trExplore,
  ...trProfile,
  ...trSocial,
  ...trModeration,
  ...trPush,
  tabs: {
    map: 'Harita',
    explore: 'Keşfet',
    record: 'Kaydet',
    feed: 'Akış',
    profile: 'Profil',
  },
  common: {
    stars: (rating: string) => `${rating} yıldız`,
    elevationProfile: 'Yükseklik profili',
    loading: 'Yükleniyor…',
    retry: 'Tekrar dene',
    close: 'Kapat',
    ok: 'Tamam',
    back: 'Geri',
    continue: 'Devam Et',
    signOut: 'Çıkış yap',
  },
  welcome: {
    badge: 'HAREKETE GEÇ',
    title: 'Şehrini adım adım keşfet',
    subtitle:
      "İstanbul'un en güzel yürüyüş, koşu ve bisiklet rotalarını keşfet, toplulukla birlikte hareket et.",
    start: 'Başlayalım',
    haveAccount: 'Zaten hesabım var',
  },
  auth: {
    title: "Rota'ya katıl",
    subtitle: "Rotanı çizmeye ve İstanbul'u adımlamaya hazır mısın?",
    tabLogin: 'Giriş Yap',
    tabSignup: 'Kayıt Ol',
    google: 'Google ile Devam Et',
    orEmail: 'Veya e-posta ile',
    emailLabel: 'E-POSTA ADRESİ',
    emailPlaceholder: 'E-posta adresin',
    passwordLabel: 'ŞİFRE',
    passwordPlaceholder: 'Şifren',
    forgot: 'Şifremi unuttum?',
    continueEmail: 'E-posta ile Devam Et',
    noAccount: 'Hesabın yok mu?',
    hasAccount: 'Zaten hesabın var mı?',
    legalPrefix: "Devam ederek Rota'nın ",
    legalTerms: 'Kullanım Koşulları',
    legalAnd: ' ve ',
    legalPrivacy: 'Gizlilik Politikası',
    legalSuffix: "'nı kabul etmiş olursun.",
    showPassword: 'Şifreyi göster',
    hidePassword: 'Şifreyi gizle',
    checkEmail:
      'Hesabını doğrulamak için e-postana gönderdiğimiz bağlantıya dokun, sonra giriş yap.',
    resetSent: 'Şifre sıfırlama bağlantısı e-postana gönderildi.',
    enterEmailFirst: 'Önce e-posta adresini yaz.',
    validation: {
      email: 'Geçerli bir e-posta adresi yaz.',
      passwordShort: 'Şifre en az 8 karakter olmalı.',
    },
    errors: {
      invalidCredentials: 'E-posta veya şifre hatalı.',
      emailNotConfirmed: 'E-postanı henüz doğrulamadın. Gelen kutunu kontrol et.',
      alreadyRegistered: 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.',
      weakPassword: 'Şifre çok zayıf. En az 8 karakter kullan.',
      rateLimited: 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.',
      network: 'Bağlantı kurulamadı. İnternetini kontrol et.',
      notConfigured: 'Supabase ayarları eksik. .env dosyasını doldurup uygulamayı yeniden başlat.',
      generic: 'Bir sorun oluştu. Lütfen tekrar dene.',
    },
  },
  onboarding: {
    step: (n: number, total: number) => `ADIM ${n} / ${total}`,
    stepProfile: 'Profil Kurulumu',
    title: 'Seni tanıyalım',
    subtitle: 'Sana en uygun rotaları önerebilmemiz için tercihlerini belirle.',
    activitiesTitle: 'Hangi aktiviteleri yapıyorsun?',
    multiSelect: 'Çoklu seçim',
    activities: {
      walk: { title: 'Yürüyüş', subtitle: 'Tempolu ve sahil turları' },
      run: { title: 'Koşu', subtitle: 'Sabah koşuları ve interval' },
      bike: { title: 'Bisiklet', subtitle: 'Sahil yolu ve tırmanış parkurları' },
    },
    levelTitle: 'Deneyim seviyen nedir?',
    levelSubtitle: 'Eğim ve mesafe zorluk derecesini belirler.',
    levels: {
      beginner: 'Yeni Başlıyorum',
      intermediate: 'Ara Sıra',
      advanced: 'Düzenli',
    },
    paceTitle: 'Koşu tempo tercihin',
    optional: 'İsteğe bağlı',
    targetPace: 'HEDEF HIZ',
    paceUnit: 'dk / km',
    paceFast: 'Hızlı',
    paceEasy: 'Hafif',
    paceBadge: { fast: 'Hızlı Tempo', medium: 'Orta Tempo', easy: 'Hafif Tempo' },
    later: 'Tercihleri daha sonra profilinden değiştirebilirsin.',
    saveError: 'Tercihlerin kaydedilemedi. Tekrar dene.',
  },
  location: {
    title: 'Konumunu paylaş',
    subtitle:
      'Yakınındaki rotaları göstermek ve başlangıç noktanı otomatik belirlemek için konumuna ihtiyacımız var.',
    points: [
      'Sadece uygulamayı kullanırken konumuna bakarız.',
      'Konumunu başkalarıyla paylaşmayız.',
      'İstediğin zaman cihaz ayarlarından kapatabilirsin.',
    ],
    allow: 'Konuma izin ver',
    skip: 'Şimdilik atla',
    deniedNote:
      'İzin verilmedi. Haritada konumu elle seçebilirsin; izni sonra ayarlardan açabilirsin.',
    saveError: 'Kurulum tamamlanamadı. Tekrar dene.',
  },
  map: {
    title: 'Harita',
    searchPlaceholder: 'Nereye gitmek istersin?',
    filterAll: 'Tümü',
    activity: { walk: 'Yürüyüş', run: 'Koşu', bike: 'Bisiklet' },
    createRoute: 'Rota Oluştur',
    locate: 'Konumuma git',
    resetNorth: 'Kuzeye çevir',
    profile: 'Profil',
    nearbyTitle: 'Yakınındaki popüler rotalar',
    seeAll: (n: number) => `Tümü (${n})`,
    difficulty: { easy: 'Kolay', medium: 'Orta', hard: 'Zor' },
    routeOf: (title: string, rating: string) => `${title}, puan ${rating}`,
    emptyTitle: 'Yakınında henüz rota yok',
    emptyBody: 'Farklı bir aktivite seçmeyi dene ya da kendi rotanı oluştur.',
    errorTitle: 'Rotalar yüklenemedi',
    errorBody: 'Bağlantını kontrol edip tekrar dene.',
    permissionTitle: 'Konum izni kapalı',
    permissionBody:
      'Yakınındaki rotaları göstermek için konumuna ihtiyacımız var. Şimdilik İstanbul merkezindeki rotalar gösteriliyor.',
    permissionAllow: 'Konuma izin ver',
    permissionSettings: 'Ayarları aç',
    webPlaceholder: 'Harita yalnızca mobil uygulamada (development build) görüntülenir.',
  },
  routes: {
    errors: {
      network: 'Rota servisine bağlanılamadı. İnternetini kontrol edip tekrar dene.',
      generic: 'Rotalar oluşturulamadı. Lütfen tekrar dene.',
    },
  },
  gate: {
    profileErrorTitle: 'Profilin yüklenemedi',
    profileErrorBody: 'Bağlantını kontrol edip tekrar dene.',
  },
} as const;

export type Translations = typeof tr;
