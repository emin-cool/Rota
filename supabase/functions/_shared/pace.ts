import type { ActivityType, Slope } from './types.ts';

/** CLAUDE.md sabitleri. */
export const WALK_KMH = 4.8;
export const BIKE_KMH = 16;
export const DEFAULT_RUN_PACE_SEC_PER_KM = 390; // 6:30 dk/km
/** Her 10 m tırmanış için +1 dk. */
export const CLIMB_M_PER_EXTRA_MIN = 10;
/** Hedef mesafe toleransı ±%10. */
export const DISTANCE_TOLERANCE = 0.1;

/**
 * Rota henüz yokken, kullanıcının eğim tercihinden beklenen tırmanış (m/km).
 * Süreyi mesafeye çevirirken eğim düzeltmesi için tahmin olarak kullanılır.
 */
export const EXPECTED_CLIMB_M_PER_KM: Record<Slope, number> = {
  flat: 3,
  some: 8,
  hilly: 15,
};

/** Aktivitenin düz zemindeki hızı (km/s). Koşuda tempodan (sn/km) türetilir. */
export function speedKmh(activity: ActivityType, paceSecPerKm?: number): number {
  if (activity === 'bike') return BIKE_KMH;
  if (activity === 'run') {
    const pace = paceSecPerKm && paceSecPerKm > 0 ? paceSecPerKm : DEFAULT_RUN_PACE_SEC_PER_KM;
    return 3600 / pace;
  }
  return WALK_KMH;
}

/**
 * Süre → hedef mesafe (metre), eğim düzeltmesiyle:
 * süre = d/hız·60 + (g·d)/10  ⇒  d = süre / (60/hız + g/10), g = m tırmanış/km.
 */
export function durationToDistanceM(
  activity: ActivityType,
  durationMin: number,
  slope: Slope,
  paceSecPerKm?: number,
): number {
  const speed = speedKmh(activity, paceSecPerKm);
  const climbPerKm = EXPECTED_CLIMB_M_PER_KM[slope];
  const minutesPerKm = 60 / speed + climbPerKm / CLIMB_M_PER_EXTRA_MIN;
  return Math.round((durationMin / minutesPerKm) * 1000);
}

/** Mesafe + tırmanış → tahmini süre (dk, tam sayı). */
export function estimateDurationMin(
  activity: ActivityType,
  distanceM: number,
  ascentM: number,
  paceSecPerKm?: number,
): number {
  const base = (distanceM / 1000 / speedKmh(activity, paceSecPerKm)) * 60;
  return Math.max(1, Math.round(base + ascentM / CLIMB_M_PER_EXTRA_MIN));
}

/** Gerçek mesafe hedefin ±tolerans'ı içinde mi? */
export function withinTolerance(
  actualM: number,
  targetM: number,
  tolerance = DISTANCE_TOLERANCE,
): boolean {
  return Math.abs(actualM - targetM) <= targetM * tolerance;
}
