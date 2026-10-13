/**
 * Tasarım token'ları — kaynak: design/stitch/bosphorus_kinetic/DESIGN.md
 * ("Bosphorus Kinetic") ve Stitch HTML'lerindeki tailwind-config.
 * tailwind.config.ts bu dosyayı okur; tek doğruluk kaynağı burasıdır.
 */

/** Material tarzı rol renkleri (Stitch tailwind-config ile birebir). */
const roleColors = {
  surface: '#f9f9ff',
  'surface-dim': '#d3daef',
  'surface-bright': '#f9f9ff',
  'surface-container-lowest': '#ffffff',
  'surface-container-low': '#f1f3ff',
  'surface-container': '#e9edff',
  'surface-container-high': '#e1e8fd',
  'surface-container-highest': '#dce2f7',
  'on-surface': '#141b2b',
  'on-surface-variant': '#3e4945',
  'inverse-surface': '#293040',
  'inverse-on-surface': '#edf0ff',
  outline: '#6e7a75',
  'outline-variant': '#bdc9c4',
  'surface-tint': '#006b57',
  primary: '#00614f',
  'on-primary': '#ffffff',
  'primary-container': '#0e7c66',
  'on-primary-container': '#bcffe9',
  'inverse-primary': '#7bd7bd',
  secondary: '#ab3500',
  'on-secondary': '#ffffff',
  'secondary-container': '#fe6a34',
  'on-secondary-container': '#5d1900',
  tertiary: '#00614f',
  'on-tertiary': '#ffffff',
  'tertiary-container': '#007c65',
  'on-tertiary-container': '#b9ffe8',
  error: '#ba1a1a',
  'on-error': '#ffffff',
  'error-container': '#ffdad6',
  'on-error-container': '#93000a',
  'primary-fixed': '#97f4d9',
  'primary-fixed-dim': '#7bd7bd',
  'on-primary-fixed': '#002019',
  'on-primary-fixed-variant': '#005141',
  'secondary-fixed': '#ffdbd0',
  'secondary-fixed-dim': '#ffb59d',
  'on-secondary-fixed': '#390c00',
  'on-secondary-fixed-variant': '#832600',
  'tertiary-fixed': '#85f7d7',
  'tertiary-fixed-dim': '#68dabc',
  'on-tertiary-fixed': '#002019',
  'on-tertiary-fixed-variant': '#005141',
  background: '#f9f9ff',
  'on-background': '#141b2b',
  'surface-variant': '#dce2f7',
} as const;

/** DESIGN.md "Palette Roles" bölümündeki marka renkleri. */
const brandColors = {
  brand: {
    DEFAULT: '#0E7C66', // Bosphorus Teal
    deep: '#0A5E4E', // basılı durum
    mid: '#149B80', // yükseklik grafiği, tempo
    soft: '#E6F4F1', // aktif chip / seçili segment
  },
  accent: {
    DEFAULT: '#FF6B35', // Sunset Orange
    deep: '#C2410C', // beyaz yazılı zemin ve turuncu metin (AA: beyaz üstünde 5,2:1)
    pressed: '#9A3412', // basılı durum
    soft: '#FFF0EB',
  },
  white: '#FFFFFF', // renkli zemin üstündeki ikon/metin
  star: '#D97706', // puan yıldızı (beyaz üstünde 3,2:1)
  canvas: '#F7F8F6', // sıcak kırık beyaz zemin
  hairline: '#E5E7EB', // ince ayırıcı / kart kenarlığı
  // Canlı takip (karanlık tema) — Stitch canl_aktivite ekranından.
  live: {
    bg: '#101915',
    card: '#16201B',
    'card-deep': '#14231E',
    'card-green': '#172D24',
    border: '#203028',
    ok: '#10B981',
    alert: '#FF5449',
    'alert-soft': '#FFD7C7',
    'alert-bg': '#2F1407',
  },
  // Aktivite renkleri: yürüyüş = marka yeşili, koşu = turuncu, bisiklet = mavi (Stitch route4Grad).
  activity: {
    walk: '#0E7C66',
    run: '#FF6B35',
    bike: '#0284C7',
  },
  'activity-soft': {
    walk: '#E6F4F1',
    run: '#FFF0EB',
    bike: '#E0F2FE',
  },
  ink: {
    DEFAULT: '#111827', // birincil metin
    secondary: '#4B5563',
    muted: '#6B7280', // AA: beyaz üstünde 4,8:1
  },
} as const;

export const colors = { ...roleColors, ...brandColors } as const;

/** Köşe yarıçapları (DESIGN.md `rounded`). Kartlar `rounded-lg` (16 px). */
export const radius = {
  sm: '0.25rem',
  DEFAULT: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  full: '9999px',
} as const;

/** 8 pt ızgara + isimli boşluklar (DESIGN.md `spacing`). */
export const spacing = {
  gutter: '1rem',
  margin: '1rem',
  'space-xs': '0.25rem',
  'space-sm': '0.5rem',
  'space-md': '1rem',
  'space-lg': '1.5rem',
  'space-xl': '2rem',
} as const;

/**
 * Plus Jakarta Sans — React Native'de ağırlık, font ailesi adıyla seçilir.
 * Adlar `@expo-google-fonts/plus-jakarta-sans` export'larıyla aynıdır
 * ve `src/theme/fonts.ts` içinde yüklenir.
 */
export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

type TypeStyle = {
  size: number;
  lineHeight: number;
  /** em cinsinden; RN piksel istediği için aşağıda çevrilir. */
  tracking: number;
  weight: keyof typeof fontFamily;
};

/** DESIGN.md `typography` ölçeği. */
export const typography = {
  'display-hero': { size: 40, lineHeight: 48, tracking: -0.03, weight: 'extrabold' },
  'headline-lg': { size: 30, lineHeight: 38, tracking: -0.02, weight: 'bold' },
  'headline-md': { size: 22, lineHeight: 28, tracking: -0.015, weight: 'bold' },
  'headline-sm': { size: 18, lineHeight: 24, tracking: -0.01, weight: 'semibold' },
  'metric-numeral': { size: 34, lineHeight: 38, tracking: -0.025, weight: 'extrabold' },
  'body-lg': { size: 16, lineHeight: 24, tracking: 0, weight: 'regular' },
  'body-md': { size: 14, lineHeight: 20, tracking: 0, weight: 'regular' },
  'body-md-medium': { size: 14, lineHeight: 20, tracking: 0, weight: 'medium' },
  'label-caps': { size: 11, lineHeight: 14, tracking: 0.06, weight: 'bold' },
  'label-sm': { size: 12, lineHeight: 16, tracking: 0.01, weight: 'medium' },
} as const satisfies Record<string, TypeStyle>;

export type TypographyVariant = keyof typeof typography;

/** Tailwind `fontSize` girdisi: text-headline-md vb. (boyut + satır yüksekliği + harf aralığı). */
export const fontSize = Object.fromEntries(
  Object.entries(typography).map(([name, t]) => [
    name,
    [
      `${t.size}px`,
      { lineHeight: `${t.lineHeight}px`, letterSpacing: `${+(t.size * t.tracking).toFixed(2)}px` },
    ],
  ]),
) as Record<TypographyVariant, [string, { lineHeight: string; letterSpacing: string }]>;

/** Gölge seviyeleri (DESIGN.md "Elevation & Depth") — RN shadow stilleri. */
export const shadows = {
  level1: {
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  level2: {
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  level3: {
    shadowColor: '#0E7C66',
    shadowOpacity: 0.08,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  /** Ortadaki Kaydet butonu için turuncu parıltı. */
  record: {
    shadowColor: '#fe6a34',
    shadowOpacity: 0.38,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;

/** Bottom sheet tutamaç noktaları (DESIGN.md: 110 pt peek, %50, %90). */
export const sheetSnapPoints = { peek: 110, half: '50%', full: '90%' } as const;

/** Minimum dokunma alanı (pt). */
export const MIN_TOUCH = 44;

export const tokens = { colors, radius, spacing, fontFamily, fontSize, shadows };
