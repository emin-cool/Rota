import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import type { TypographyVariant } from '@/theme/tokens';

/**
 * Tailwind sınıfları statik taranır, bu yüzden her varyantın tam sınıf adı
 * burada düz metin olarak yazılır (dinamik birleştirme yok).
 */
const variantClass: Record<TypographyVariant, string> = {
  'display-hero': 'font-extrabold text-display-hero',
  'headline-lg': 'font-bold text-headline-lg',
  'headline-md': 'font-bold text-headline-md',
  'headline-sm': 'font-semibold text-headline-sm',
  'metric-numeral': 'font-extrabold text-metric-numeral',
  'body-lg': 'font-regular text-body-lg',
  'body-md': 'font-regular text-body-md',
  'body-md-medium': 'font-medium text-body-md-medium',
  'label-caps': 'font-bold text-label-caps',
  'label-sm': 'font-medium text-label-sm',
};

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  className?: string;
};

/**
 * Temel metin bileşeni. Varsayılan renk `ink`; renk için className ver (örn. `text-brand`).
 * Türkçe "İ/ı" bozulmasın diye büyük harf dönüşümü (uppercase) kullanma.
 */
export function Text({ variant = 'body-md', className = '', style, ...rest }: TextProps) {
  return (
    <RNText
      className={`text-ink ${variantClass[variant]} ${className}`}
      // Canlı takipte rakamlar zıplamasın diye metriklerde tabular rakam.
      style={[variant === 'metric-numeral' ? { fontVariant: ['tabular-nums'] } : null, style]}
      {...rest}
    />
  );
}

type HeadingProps = Omit<TextProps, 'variant'>;

export const DisplayHero = (p: HeadingProps) => (
  <Text variant="display-hero" accessibilityRole="header" {...p} />
);
export const HeadlineLg = (p: HeadingProps) => (
  <Text variant="headline-lg" accessibilityRole="header" {...p} />
);
export const HeadlineMd = (p: HeadingProps) => (
  <Text variant="headline-md" accessibilityRole="header" {...p} />
);
export const HeadlineSm = (p: HeadingProps) => (
  <Text variant="headline-sm" accessibilityRole="header" {...p} />
);
export const Metric = (p: HeadingProps) => <Text variant="metric-numeral" {...p} />;
