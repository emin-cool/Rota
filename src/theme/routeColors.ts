import { colors } from './tokens';

/** Sonuç ekranında 3 rotanın renkleri (kart sırasıyla aynı): yeşil, turuncu, mavi. */
export const ROUTE_COLORS = [
  colors.brand.DEFAULT,
  colors.accent.DEFAULT,
  colors.activity.bike,
] as const;

export const routeColor = (index: number) => ROUTE_COLORS[index % ROUTE_COLORS.length]!;
