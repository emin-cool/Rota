import type { Sample } from './geo.ts';
import type { Scenery, Slope, SurfacePref } from './types.ts';

/** Rota çevresinde (50 m) aranan OSM kategorileri. */
export type Category = 'coast' | 'green' | 'historic' | 'mainRoad';

/** docs/03 "Manzara skoru": sahil/su +3, park/orman +2, tarihi +1, ana yol −2. */
export const CATEGORY_WEIGHT: Record<Category, number> = {
  coast: 3,
  green: 2,
  historic: 1,
  mainRoad: -2,
};

/** Kullanıcının seçtiği manzara türünün puanı ×2. */
export const SELECTED_SCENERY_MULTIPLIER = 2;
/** Örnekleme aralığı ve tampon (CLAUDE.md). */
export const SAMPLE_STEP_M = 100;
export const BUFFER_M = 50;

/** Rota üstünde bir örnek noktanın puanı. Her kategori noktada bir kez sayılır. */
export function sampleScore(hits: ReadonlySet<Category>, scenery: readonly Scenery[]): number {
  let score = 0;
  for (const cat of hits) {
    const weight = CATEGORY_WEIGHT[cat];
    const selected = cat !== 'mainRoad' && scenery.includes(cat);
    score += selected ? weight * SELECTED_SCENERY_MULTIPLIER : weight;
  }
  return score;
}

/**
 * Örnek başına ortalama puanı 0–100'e ölçekler (sigmoid; mutlak ölçek, adaylar arası min-max değil).
 * ortalama 1 → 50, 3 → ~88, −1 → ~12.
 */
export function scaleScenic(meanSampleScore: number): number {
  const score = 100 / (1 + Math.exp(-(meanSampleScore - 1)));
  return Math.round(Math.min(100, Math.max(0, score)));
}

export function scenicScore(
  allHits: ReadonlyArray<ReadonlySet<Category>>,
  scenery: readonly Scenery[],
): number {
  if (allHits.length === 0) return 50;
  const mean = allHits.reduce((sum, hits) => sum + sampleScore(hits, scenery), 0) / allHits.length;
  return scaleScenic(mean);
}

/** Nötr skor: manzara verisi alınamadığında kullanılır. */
export const NEUTRAL_SCENIC = 50;

/** Ana yolda geçen örneklerin oranı (0–1). */
export function mainRoadShare(allHits: ReadonlyArray<ReadonlySet<Category>>): number {
  if (allHits.length === 0) return 0;
  return allHits.filter((h) => h.has('mainRoad')).length / allHits.length;
}

/** Eğim: 100 m'lik pencerelerde %6'dan dik olanların sayısı. */
export const STEEP_GRADE_PCT = 6;

export function steepSegmentCount(
  samples: readonly Sample[],
  thresholdPct = STEEP_GRADE_PCT,
): number {
  let count = 0;
  for (let i = 1; i < samples.length; i++) {
    const run = samples[i]!.d - samples[i - 1]!.d;
    if (run < 20) continue; // çok kısa son parça güvenilir eğim vermez
    const grade = (Math.abs(samples[i]!.z - samples[i - 1]!.z) / run) * 100;
    if (grade > thresholdPct) count++;
  }
  return count;
}

/** Toplam tırmanış (m): rakım artışlarının toplamı, 1 m altındaki gürültü yok sayılır. */
export function ascentFromSamples(samples: readonly Sample[]): number {
  let gain = 0;
  for (let i = 1; i < samples.length; i++) {
    const diff = samples[i]!.z - samples[i - 1]!.z;
    if (diff > 1) gain += diff;
  }
  return Math.round(gain);
}

/** Düz: dik 100 m başına −15. Yokuş modu: tırmanış ödülü (negatif ceza), en çok 20. */
export function slopePenalty(slope: Slope, steepSegments: number, ascentM: number): number {
  if (slope === 'flat') return steepSegments * 15;
  if (slope === 'hilly') return -Math.min(20, ascentM / 10);
  return 0;
}

/** avoidTraffic: ana yol yüzdesi × 0,5. */
export function trafficPenalty(avoidTraffic: boolean | undefined, share: number): number {
  return avoidTraffic ? share * 100 * 0.5 : 0;
}

/** Hedef mesafeden % sapma × 1. */
export function distancePenalty(actualM: number, targetM: number | null): number {
  if (!targetM) return 0;
  return (Math.abs(actualM - targetM) / targetM) * 100;
}

/** amenities: her çeşme/tuvalet +2, en çok +10. */
export function breakBonus(amenities: boolean | undefined, waterAndToiletCount: number): number {
  return amenities ? Math.min(10, waterAndToiletCount * 2) : 0;
}

/** Zemin tercihi: istenmeyen zemin payı kadar ceza. */
export function surfacePenalty(pref: SurfacePref | undefined, unpavedShare: number): number {
  if (pref === 'paved') return unpavedShare * 40;
  if (pref === 'unpaved') return (1 - unpavedShare) * 20;
  return 0;
}

export type ScoreParts = {
  scenic: number;
  slope: number;
  traffic: number;
  distance: number;
  surface: number;
  bonus: number;
};

/** skor = scenic − eğim − trafik − mesafe sapması − zemin + mola bonusu */
export function totalScore(p: ScoreParts): number {
  return p.scenic - p.slope - p.traffic - p.distance - p.surface + p.bonus;
}
