import type { LngLat } from '@/lib/geo';
import { computeStats, smoothPoints, type TrackPoint } from '@/lib/tracking';
import type { ActivityType } from '@/types/routes';

/** Kilo profilde tutulmuyor; tahmini kalori bu varsayılanla hesaplanır (arayüzde "tahmini" yazar). */
export const DEFAULT_WEIGHT_KG = 70;

/** kcal ≈ katsayı × kilo × km (yürüyüş ~0,5, koşu ~1,0, bisiklet ~0,25). */
const KCAL_PER_KG_KM: Record<ActivityType, number> = { walk: 0.5, run: 1.0, bike: 0.25 };

export function estimateCalories(
  activity: ActivityType,
  distanceM: number,
  weightKg = DEFAULT_WEIGHT_KG,
): number {
  return Math.round((KCAL_PER_KG_KM[activity] * weightKg * distanceM) / 1000);
}

/** Planlanan mesafeye göre tamamlanma yüzdesi; rota yoksa null. */
export function goalPercent(distanceM: number, plannedM: number | null): number | null {
  if (!plannedM || plannedM <= 0) return null;
  return Math.round((distanceM / plannedM) * 100);
}

/** Planar yaklaşım (metre): küçük alanlarda Douglas-Peucker için yeterli. */
function toMeters(coords: LngLat[]): [number, number][] {
  const lat0 = coords[0]![1];
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  return coords.map(([lng, lat]) => [lng * kx, lat * 110_540]);
}

function perpDistance(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Douglas-Peucker ile çizgiyi sadeleştirir; tolerans metre cinsinden. Uç noktalar korunur.
 * Yüklenecek track'in boyutunu küçültmek için (saniyede bir nokta → birkaç yüz nokta).
 */
export function simplifyTrack(coords: LngLat[], toleranceM = 3): LngLat[] {
  if (coords.length <= 2) return coords;
  const m = toMeters(coords);
  const keep = new Array<boolean>(coords.length).fill(false);
  keep[0] = true;
  keep[coords.length - 1] = true;
  // Özyineleme yerine açık yığın: binlerce noktada çağrı yığını taşmasın.
  const stack: [number, number][] = [[0, coords.length - 1]];
  while (stack.length > 0) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDistance(m[i]!, m[s]!, m[e]!);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxD > toleranceM) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  return coords.filter((_, i) => keep[i]);
}

/** PostgREST'in kabul ettiği EWKT; en az 2 nokta yoksa null. */
export function toLineEwkt(coords: LngLat[]): string | null {
  if (coords.length < 2) return null;
  return `SRID=4326;LINESTRING(${coords.map((c) => `${c[0]} ${c[1]}`).join(',')})`;
}

export type ActivitySummary = {
  distanceM: number;
  durationSec: number;
  movingSec: number;
  avgPaceSecPerKm: number | null;
  ascentM: number;
  kcal: number;
  /** Sadeleştirilmiş izlenen yol. */
  track: LngLat[];
};

type SessionTimes = {
  activity_type: ActivityType;
  started_at: number;
  ended_at: number | null;
  paused_ms: number;
};

/** Yerel kayıttan özet sayıları; ekran ve yükleme aynı fonksiyonu kullanır (tutarlı olsun diye). */
export function summarize(session: SessionTimes, points: TrackPoint[]): ActivitySummary {
  const smoothed = smoothPoints(points);
  const stats = computeStats(smoothed, session.activity_type);
  const rawMs = (session.ended_at ?? session.started_at) - session.started_at - session.paused_ms;
  return {
    distanceM: Math.round(stats.distanceM),
    durationSec: Math.max(0, Math.round(rawMs / 1000)),
    movingSec: Math.round(stats.movingSec),
    avgPaceSecPerKm: stats.avgPaceSecPerKm === null ? null : Math.round(stats.avgPaceSecPerKm),
    ascentM: Math.round(stats.ascentM),
    kcal: estimateCalories(session.activity_type, stats.distanceM),
    track: simplifyTrack(smoothed.map((p) => [p.lng, p.lat] as LngLat)),
  };
}

/** Yolu width×height kutusuna orantılı sığdırır (paylaşım kartı için); boylam enlem kosinüsüyle düzeltilir. */
export function projectTrack(
  coords: LngLat[],
  width: number,
  height: number,
  padding: number,
): [number, number][] {
  if (coords.length === 0) return [];
  const lat0 = coords[0]![1];
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const xs = coords.map((c) => c[0] * kx);
  const ys = coords.map((c) => -c[1]); // ekranda y aşağı
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1e-9;
  const spanY = Math.max(...ys) - minY || 1e-9;
  const scale = Math.min((width - 2 * padding) / spanX, (height - 2 * padding) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return coords.map((_, i) => [offX + (xs[i]! - minX) * scale, offY + (ys[i]! - minY) * scale]);
}

/** Yolun sınır kutusu. */
export function trackBounds(coords: LngLat[]): { sw: LngLat; ne: LngLat } | null {
  if (coords.length === 0) return null;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [lng, lat] of coords) {
    w = Math.min(w, lng);
    e = Math.max(e, lng);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  return { sw: [w, s], ne: [e, n] };
}
