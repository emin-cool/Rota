import { colors } from './tokens';

/** Fotoğraf olmayan kartlar için gradyanlar (yalnızca tasarım token'ları). */
export const sceneryGradients = {
  coast: [colors.activity.bike, colors.brand.DEFAULT],
  green: [colors.brand.deep, colors.brand.mid],
  historic: [colors.accent.deep, colors.accent.DEFAULT],
  any: [colors['inverse-surface'], colors.outline],
} as const satisfies Record<string, readonly [string, string]>;

export const suggestionGradients = {
  recommended: [colors.brand.deep, colors.brand.DEFAULT],
  nature: [colors.brand.mid, colors.brand.deep],
  today: [colors['on-surface'], colors.brand.deep],
} as const satisfies Record<string, readonly [string, string]>;
