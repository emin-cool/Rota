import {
  EXPECTED_CLIMB_M_PER_KM,
  durationToDistanceM,
  estimateDurationMin,
} from '../../supabase/functions/_shared/pace.ts';

import { tr } from '@/i18n/tr';
import { formatDistance, type LngLat } from '@/lib/geo';
import { DEFAULT_RUN_PACE_SEC } from '@/lib/pace';
import type {
  ActivityType,
  GenerateRoutesInput,
  RoutePoi,
  RouteType,
  Scenery,
  Slope,
  SurfacePref,
} from '@/types/routes';
import type { NearbyRoute } from '@/types/database';

/** Sihirbazın tuttuğu ekstra tercihler (docs/01 "Ekstralar"). */
export type WizardExtras = {
  avoidTraffic: boolean;
  litStreets: boolean;
  amenities: boolean;
  transitEnd: boolean;
  dog: boolean;
  stroller: boolean;
  bikeLanes: boolean;
  surface: SurfacePref;
};

export type ExtraToggleKey = Exclude<keyof WizardExtras, 'surface'>;

export const EXTRA_TOGGLE_KEYS: ExtraToggleKey[] = [
  'avoidTraffic',
  'litStreets',
  'amenities',
  'transitEnd',
  'dog',
  'stroller',
  'bikeLanes',
];

export type WizardGoal = 'duration' | 'distance';

export type WizardAnswers = {
  activityType: ActivityType;
  routeType: RouteType;
  start: LngLat | null;
  startLabel: string | null;
  /** true: başlangıç, rota üretilirken cihazın o anki konumu olur. */
  startIsCurrent: boolean;
  end: LngLat | null;
  endLabel: string | null;
  goal: WizardGoal;
  durationMin: number;
  distanceKm: number;
  scenery: Scenery[];
  slope: Slope;
  extras: WizardExtras;
  paceSecPerKm: number;
};

export const DEFAULT_EXTRAS: WizardExtras = {
  avoidTraffic: false,
  litStreets: false,
  amenities: false,
  transitEnd: false,
  dog: false,
  stroller: false,
  bikeLanes: false,
  surface: 'any',
};

export const DEFAULT_ANSWERS: WizardAnswers = {
  activityType: 'walk',
  routeType: 'loop',
  start: null,
  startLabel: null,
  startIsCurrent: true,
  end: null,
  endLabel: null,
  goal: 'duration',
  durationMin: 60,
  distanceKm: 5,
  scenery: ['any'],
  slope: 'some',
  extras: DEFAULT_EXTRAS,
  paceSecPerKm: DEFAULT_RUN_PACE_SEC,
};

/** Aktiviteye göre süre/mesafe sınırları ve adımları. */
export const DURATION_LIMITS: Record<ActivityType, { min: number; max: number; step: number }> = {
  walk: { min: 10, max: 240, step: 5 },
  run: { min: 10, max: 180, step: 5 },
  bike: { min: 15, max: 360, step: 5 },
};
export const DISTANCE_LIMITS: Record<ActivityType, { min: number; max: number; step: number }> = {
  walk: { min: 1, max: 25, step: 0.5 },
  run: { min: 1, max: 42, step: 0.5 },
  bike: { min: 3, max: 100, step: 1 },
};
export const QUICK_DURATIONS_MIN = [30, 45, 60, 90];
export const QUICK_DISTANCES_KM: Record<ActivityType, number[]> = {
  walk: [2, 3, 5, 8],
  run: [3, 5, 10, 15],
  bike: [10, 20, 30, 50],
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

export function stepDuration(a: WizardAnswers, direction: 1 | -1): number {
  const { min, max, step } = DURATION_LIMITS[a.activityType];
  return clamp(a.durationMin + direction * step, min, max);
}

export function stepDistance(a: WizardAnswers, direction: 1 | -1): number {
  const { min, max, step } = DISTANCE_LIMITS[a.activityType];
  return round1(clamp(a.distanceKm + direction * step, min, max));
}

/** Aktivite değişince mevcut süre/mesafe yeni sınırlara çekilir. */
export function clampGoalToActivity(
  a: WizardAnswers,
): Pick<WizardAnswers, 'durationMin' | 'distanceKm'> {
  const d = DURATION_LIMITS[a.activityType];
  const k = DISTANCE_LIMITS[a.activityType];
  return {
    durationMin: clamp(a.durationMin, d.min, d.max),
    distanceKm: round1(clamp(a.distanceKm, k.min, k.max)),
  };
}

/** Hedef süreye karşılık gelen tahmini mesafe (km); sunucudaki hesapla aynı (eğim düzeltmeli). */
export function estimateKm(
  activity: ActivityType,
  durationMin: number,
  slope: Slope,
  paceSecPerKm: number,
): number {
  return durationToDistanceM(activity, durationMin, slope, paceSecPerKm) / 1000;
}

/** Hedef mesafeye karşılık gelen tahmini süre (dk). */
export function estimateMinutes(
  activity: ActivityType,
  distanceKm: number,
  slope: Slope,
  paceSecPerKm: number,
): number {
  const ascent = distanceKm * EXPECTED_CLIMB_M_PER_KM[slope];
  return estimateDurationMin(activity, distanceKm * 1000, ascent, paceSecPerKm);
}

/** 60 → "1 sa 00 dk", 45 → "45 dk". */
export function formatClock(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} sa ${String(m).padStart(2, '0')} dk` : `${m} dk`;
}

/** 4.8 → "4,8" */
export function formatKmValue(km: number): string {
  return String(round1(km)).replace('.', ',');
}

/** Hızlı seçim çipi için kısa km etiketi: "~4,8 km". */
export function quickChipKm(a: WizardAnswers, durationMin: number): string {
  return `~${formatKmValue(estimateKm(a.activityType, durationMin, a.slope, a.paceSecPerKm))} km`;
}

/**
 * Cevaplardan Edge Function girdisi üretir. Başlangıç/bitiş eksikse null.
 * `currentLocation`: "Mevcut konum" seçiliyken kullanılacak anlık konum.
 */
export function buildGenerateInput(
  a: WizardAnswers,
  currentLocation: LngLat | null,
): GenerateRoutesInput | null {
  const start = a.startIsCurrent ? (currentLocation ?? a.start) : a.start;
  if (!start) return null;
  if (a.routeType === 'a_b' && !a.end) return null;

  const extras: NonNullable<GenerateRoutesInput['extras']> = {};
  if (a.extras.avoidTraffic) extras.avoidTraffic = true;
  if (a.extras.litStreets) extras.litStreets = true;
  if (a.extras.amenities) extras.amenities = true;
  if (a.extras.transitEnd && a.routeType === 'a_b') extras.transitEnd = true;
  if (a.extras.dog && a.activityType !== 'bike') extras.dog = true;
  if (a.extras.stroller && a.activityType === 'walk') extras.stroller = true;
  if (a.extras.bikeLanes && a.activityType === 'bike') extras.bikeLanes = true;
  if (a.extras.surface !== 'any') extras.surface = a.extras.surface;

  const input: GenerateRoutesInput = {
    activityType: a.activityType,
    routeType: a.routeType,
    start,
    scenery: a.scenery.length > 0 ? a.scenery : ['any'],
    slope: a.slope,
    extras,
  };
  if (a.routeType === 'a_b') input.end = a.end!;
  else if (a.goal === 'duration') input.durationMin = a.durationMin;
  else input.distanceM = Math.round(a.distanceKm * 1000);
  if (a.activityType === 'run') input.paceSecPerKm = a.paceSecPerKm;
  return input;
}

/** Manzara çoklu seçimi: "Fark etmez" ile diğerleri birbirini dışlar; hiçbiri kalmazsa "Fark etmez". */
export function toggleScenery(current: Scenery[], value: Scenery): Scenery[] {
  if (value === 'any') return ['any'];
  const without = current.filter((s) => s !== 'any');
  const next = without.includes(value) ? without.filter((s) => s !== value) : [...without, value];
  return next.length > 0 ? next : ['any'];
}

/** Bu aktivite/rota tipinde gösterilecek ekstra anahtarlar. */
export function visibleExtraKeys(activity: ActivityType, routeType: RouteType): ExtraToggleKey[] {
  return EXTRA_TOGGLE_KEYS.filter((key) => {
    if (key === 'transitEnd') return routeType === 'a_b';
    if (key === 'dog') return activity !== 'bike';
    if (key === 'stroller') return activity === 'walk';
    if (key === 'bikeLanes') return activity === 'bike';
    return true;
  });
}

export function activeExtraCount(a: WizardAnswers): number {
  return visibleExtraKeys(a.activityType, a.routeType).filter((k) => a.extras[k]).length;
}

export type RelaxSuggestion = { id: string; label: string; patch: Partial<WizardAnswers> };

/** Rota bulunamadığında kriterleri gevşetmek için en çok 3 öneri. */
export function relaxSuggestions(a: WizardAnswers): RelaxSuggestion[] {
  const out: RelaxSuggestion[] = [];
  if (a.slope === 'flat') {
    out.push({ id: 'slope', label: tr.wizard.relax.slope, patch: { slope: 'some' } });
  }
  if (a.extras.surface !== 'any') {
    out.push({
      id: 'surface',
      label: tr.wizard.relax.surface,
      patch: { extras: { ...a.extras, surface: 'any' } },
    });
  }
  if (activeExtraCount(a) > 0) {
    out.push({
      id: 'extras',
      label: tr.wizard.relax.extras,
      patch: { extras: { ...DEFAULT_EXTRAS, surface: a.extras.surface } },
    });
  }
  if (!(a.scenery.length === 1 && a.scenery[0] === 'any')) {
    out.push({ id: 'scenery', label: tr.wizard.relax.scenery, patch: { scenery: ['any'] } });
  }
  if (a.routeType !== 'a_b' && a.goal === 'duration' && a.durationMin < 45) {
    out.push({
      id: 'longer',
      label: tr.wizard.relax.longer(45),
      patch: { durationMin: 45 },
    });
  }
  return out.slice(0, 3);
}

export type PoiCounts = Record<RoutePoi['type'], number>;

export function countPois(pois: RoutePoi[]): PoiCounts {
  const counts: PoiCounts = { water: 0, toilet: 0, cafe: 0, bench: 0, transit: 0 };
  for (const p of pois) counts[p.type] += 1;
  return counts;
}

/** Kartın başlığı: "Emirgan • Dönüşlü yürüyüş". */
export function routeTitle(
  input: Pick<GenerateRoutesInput, 'activityType' | 'routeType'>,
  startName: string | null,
): string {
  const kind = tr.results.routeKind[input.routeType];
  const noun = tr.results.activityNoun[input.activityType];
  return `${startName ?? tr.results.defaultStartName} • ${kind} ${noun}`;
}

/** Tırmanış yoğunluğuna göre zorluk (routes.difficulty). */
export function difficultyOf(distanceM: number, ascentM: number): 'easy' | 'medium' | 'hard' {
  const perKm = ascentM / Math.max(distanceM / 1000, 0.1);
  if (perKm < 15) return 'easy';
  if (perKm < 35) return 'medium';
  return 'hard';
}

/** Yakındaki rotalardan, seçilen manzara/eğim kriterlerine uyanlar ("Eşleşen rotalar"). */
export function matchNearby(routes: NearbyRoute[], a: WizardAnswers): NearbyRoute[] {
  const wantsScenery = !(a.scenery.length === 1 && a.scenery[0] === 'any');
  return routes
    .filter((r) => r.activity_type === a.activityType)
    .filter((r) => !wantsScenery || (r.scenic_score ?? 0) >= 60)
    .filter((r) => {
      const perKm = r.elevation_gain_m / Math.max(r.distance_m / 1000, 0.1);
      if (a.slope === 'flat') return perKm <= 15;
      if (a.slope === 'hilly') return perKm >= 30;
      return true;
    })
    .sort((x, y) => y.avg_rating - x.avg_rating || y.completion_count - x.completion_count);
}

/** "Günün tavsiyesi": öne çıkan rota varsa o, yoksa en yüksek puanlı. */
export function todaysPick(routes: NearbyRoute[]): NearbyRoute | null {
  if (routes.length === 0) return null;
  const featured = routes.filter((r) => r.is_featured);
  const pool = featured.length > 0 ? featured : routes;
  return [...pool].sort((x, y) => y.avg_rating - x.avg_rating)[0] ?? null;
}

/** Süre/mesafe adımındaki iki öneri kartı: en yüksek puanlı ve en manzaralı (farklı rotalar). */
export function pickRecommendations(routes: NearbyRoute[]): {
  recommended: NearbyRoute | null;
  nature: NearbyRoute | null;
} {
  const byRating = [...routes].sort(
    (x, y) => y.avg_rating - x.avg_rating || y.completion_count - x.completion_count,
  );
  const recommended = byRating[0] ?? null;
  const nature =
    [...routes]
      .filter((r) => r.id !== recommended?.id)
      .sort((x, y) => (y.scenic_score ?? 0) - (x.scenic_score ?? 0))[0] ?? null;
  return { recommended, nature };
}

/** "4,8 km • 1 sa" gibi kısa özet. */
export function routeMeta(r: Pick<NearbyRoute, 'distance_m' | 'est_duration_min'>): string {
  const parts = [formatDistance(r.distance_m)];
  if (r.est_duration_min) parts.push(formatClock(r.est_duration_min).replace(' 00 dk', ' sa'));
  return parts.join(' • ');
}
