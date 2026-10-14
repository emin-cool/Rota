import { distPointToSegmentM } from '../../supabase/functions/_shared/geo.ts';

import { tr } from '@/i18n/tr';
import { bearingDeg, haversineM, type LngLat } from '@/lib/geo';
import type { ActivityType } from '@/types/routes';

/** Canlı takip hesapları (saf fonksiyonlar). Sabitler CLAUDE.md "Sabitler" bölümünden. */

/** Doğruluğu bundan kötü (büyük) olan GPS noktaları atılır. */
export const MAX_ACCURACY_M = 25;
/** Rotadan sapma eşiği ve teyit için gereken ardışık örnek sayısı. */
export const OFF_ROUTE_M = 40;
export const OFF_ROUTE_CONFIRM = 3;
/** Bundan kısa adımlar (GPS titreşimi) mesafeye eklenmez. */
export const MIN_STEP_M = 2;
/** Bundan yavaş hareket "durma" sayılır (m/s): hareket süresi için. */
export const MOVING_SPEED_MS = 0.3;
/** Anlık tempo penceresi (sn). */
export const CURRENT_PACE_WINDOW_S = 30;
/** Tırmanış hesabında rakım gürültüsünü süzen eşik (m). */
export const ASCENT_HYSTERESIS_M = 3;
/** Hareketli ortalama penceresi (nokta). */
export const SMOOTH_WINDOW = 3;

export type TrackPoint = {
  lat: number;
  lng: number;
  alt: number | null;
  accuracy: number | null;
  /** Saniye cinsinden zaman damgası (ms). */
  ts: number;
  /** Duraklat/devam bölümü: bölümler arası boşluk mesafeye katılmaz. */
  seg: number;
};

/** Cihazın verdiği ham konum → TrackPoint (alan adları expo-location'dan bağımsız). */
export function toTrackPoint(
  loc: {
    coords: {
      latitude: number;
      longitude: number;
      altitude: number | null;
      accuracy: number | null;
    };
    timestamp: number;
  },
  seg: number,
): TrackPoint {
  return {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    alt: loc.coords.altitude,
    accuracy: loc.coords.accuracy,
    ts: loc.timestamp,
    seg,
  };
}

const ll = (p: TrackPoint): LngLat => [p.lng, p.lat];

/** Doğruluğu yeterli mi? Bilinmeyen doğruluk güvenilmez sayılır. */
export function isAcceptable(p: { accuracy: number | null }): boolean {
  return p.accuracy !== null && p.accuracy >= 0 && p.accuracy <= MAX_ACCURACY_M;
}

/** Aktiviteye göre makul en yüksek hız (m/s); üstü GPS sıçraması sayılır. */
export function maxSpeedMs(activity: ActivityType): number {
  if (activity === 'bike') return 20; // 72 km/s
  if (activity === 'run') return 9; // ~32 km/s
  return 5; // yürüyüş: 18 km/s
}

/** Her noktayı, aynı bölümdeki son `window` noktanın ortalamasıyla yumuşatır (zaman/doğruluk korunur). */
export function smoothPoints(points: TrackPoint[], window = SMOOTH_WINDOW): TrackPoint[] {
  return points.map((p, i) => {
    let lat = 0;
    let lng = 0;
    let altSum = 0;
    let altN = 0;
    let n = 0;
    for (let j = i; j >= 0 && n < window; j--) {
      const q = points[j]!;
      if (q.seg !== p.seg) break;
      lat += q.lat;
      lng += q.lng;
      if (q.alt !== null) {
        altSum += q.alt;
        altN++;
      }
      n++;
    }
    return { ...p, lat: lat / n, lng: lng / n, alt: altN > 0 ? altSum / altN : p.alt };
  });
}

export type Stats = {
  distanceM: number;
  /** Hareket halindeki süre (sn): duran anlar hariç. */
  movingSec: number;
  /** Ortalama tempo (sn/km), mesafe çok kısaysa null. */
  avgPaceSecPerKm: number | null;
  /** Son ~30 sn'nin temposu (sn/km), yeterli veri yoksa null. */
  currentPaceSecPerKm: number | null;
  ascentM: number;
};

/** Ardışık (aynı bölümde) iki nokta arası geçerli adım mesafesi; geçersizse 0. */
function stepM(a: TrackPoint, b: TrackPoint, activity: ActivityType): number {
  if (a.seg !== b.seg) return 0;
  const d = haversineM(ll(a), ll(b));
  if (d < MIN_STEP_M) return 0;
  const dt = (b.ts - a.ts) / 1000;
  if (dt > 0 && d / dt > maxSpeedMs(activity)) return 0; // GPS sıçraması
  return d;
}

/** Yükselti kazancı: son kabul edilen rakımdan en az eşik kadar yükselince eklenir (gürültü süzülür). */
export function ascentFromAltitudes(
  alts: (number | null)[],
  hysteresis = ASCENT_HYSTERESIS_M,
): number {
  let ref: number | null = null;
  let gain = 0;
  for (const a of alts) {
    if (a === null) continue;
    if (ref === null) {
      ref = a;
      continue;
    }
    if (a - ref >= hysteresis) {
      gain += a - ref;
      ref = a;
    } else if (ref - a >= hysteresis) {
      ref = a;
    }
  }
  return gain;
}

/**
 * Noktalardan istatistik. `smoothed` yumuşatılmış noktalardır (mesafe ve tempo bunlarla,
 * ham rakım daha az gürültülü olduğundan tırmanış yumuşatılmış rakımla hesaplanır).
 */
export function computeStats(smoothed: TrackPoint[], activity: ActivityType): Stats {
  let distanceM = 0;
  let movingMs = 0;
  for (let i = 1; i < smoothed.length; i++) {
    const a = smoothed[i - 1]!;
    const b = smoothed[i]!;
    const d = stepM(a, b, activity);
    distanceM += d;
    const dt = b.ts - a.ts;
    if (a.seg === b.seg && dt > 0 && d / (dt / 1000) >= MOVING_SPEED_MS) movingMs += dt;
  }

  // Anlık tempo: son pencere
  let currentPace: number | null = null;
  const last = smoothed[smoothed.length - 1];
  if (last) {
    let windowDist = 0;
    let t0 = last.ts;
    for (let i = smoothed.length - 1; i > 0; i--) {
      const a = smoothed[i - 1]!;
      const b = smoothed[i]!;
      if (last.ts - a.ts > CURRENT_PACE_WINDOW_S * 1000) break;
      windowDist += stepM(a, b, activity);
      t0 = a.ts;
    }
    const windowSec = (last.ts - t0) / 1000;
    if (windowDist >= 10 && windowSec >= 5) currentPace = windowSec / (windowDist / 1000);
  }

  const movingSec = movingMs / 1000;
  return {
    distanceM,
    movingSec,
    avgPaceSecPerKm: distanceM >= 50 && movingSec > 0 ? movingSec / (distanceM / 1000) : null,
    currentPaceSecPerKm: currentPace,
    ascentM: ascentFromAltitudes(smoothed.map((p) => p.alt)),
  };
}

/** Süre: duraklatmalar hariç geçen saniye. */
export function elapsedSeconds(params: {
  startedAt: number;
  now: number;
  pausedMs: number;
  /** Şu an duraklatılmışsa duraklatmanın başladığı an. */
  pauseStartedAt: number | null;
}): number {
  const currentPause = params.pauseStartedAt === null ? 0 : params.now - params.pauseStartedAt;
  return Math.max(0, (params.now - params.startedAt - params.pausedMs - currentPause) / 1000);
}

/** İki mesafe arasında geçilen tam km işaretleri: (900, 2100) → [1, 2]. */
export function kmMarksCrossed(prevM: number, nextM: number, stepMeters = 1000): number[] {
  const marks: number[] = [];
  for (let k = Math.floor(prevM / stepMeters) + 1; k * stepMeters <= nextM; k++) marks.push(k);
  return marks;
}

// ---------------------------------------------------------------- planlı rota

export type RouteProgress = {
  /** Rotanın başından, en yakın noktaya kadar yol (m). */
  progressM: number;
  /** Rotaya en yakın mesafe (m). */
  distanceToRouteM: number;
  /** Aramanın kaldığı segment indeksi (ileri yönlü aramayı sürdürmek için). */
  segmentIndex: number;
};

/** Rota çizgisi için kümülatif uzunluklar (m); `cumulative[i]` = i. noktaya kadar yol. */
export function cumulativeLengths(route: LngLat[]): number[] {
  const out = [0];
  for (let i = 1; i < route.length; i++)
    out.push(out[i - 1]! + haversineM(route[i - 1]!, route[i]!));
  return out;
}

/** Rota boyunca `distanceM` kadar ilerideki nokta (rota dışına taşarsa uçlara kırpılır). */
export function pointAlongRoute(route: LngLat[], cumulative: number[], distanceM: number): LngLat {
  const total = cumulative[cumulative.length - 1] ?? 0;
  const d = Math.min(Math.max(distanceM, 0), total);
  for (let i = 1; i < route.length; i++) {
    if (d <= cumulative[i]!) {
      const segLen = cumulative[i]! - cumulative[i - 1]!;
      const t = segLen > 0 ? (d - cumulative[i - 1]!) / segLen : 0;
      const a = route[i - 1]!;
      const b = route[i]!;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
  }
  return route[route.length - 1]!;
}

/**
 * Kullanıcının rota üzerindeki yeri (`progressM`) için gidiş yönü (derece, 0 = kuzey):
 * rotada `lookAheadM` ilerideki noktaya bakılır. GPS sapmasından bağımsızdır, çünkü yön
 * ölçülen konumdan değil planlı çizgiden gelir. Rotanın son `lookAheadM` metresinde
 * ileride yeterli çizgi kalmadığı için son kısmın yönü tutulur.
 */
export function routeHeadingAt(
  route: LngLat[],
  cumulative: number[],
  progressM: number,
  lookAheadM = 30,
): number | null {
  if (route.length < 2) return null;
  const total = cumulative[cumulative.length - 1] ?? 0;
  if (total <= 0) return null;
  const from = Math.min(progressM, Math.max(0, total - lookAheadM));
  const a = pointAlongRoute(route, cumulative, from);
  const b = pointAlongRoute(route, cumulative, Math.min(total, from + lookAheadM));
  if (haversineM(a, b) < 1) return null;
  return bearingDeg(a, b);
}

/**
 * Noktanın planlı rotaya göre ilerlemesi. Döngü rotalarda başlangıç ve bitiş aynı yerde olduğundan
 * arama, son bilinen segmentten ileriye doğru dar bir pencerede yapılır; pencerede rotaya 100 m'den
 * uzaksa (rotadan çıkma / atlama) tüm rota taranır.
 */
export function advanceAlongRoute(
  route: LngLat[],
  cumulative: number[],
  point: LngLat,
  lastSegment = 0,
  window = 150,
): RouteProgress {
  const search = (from: number, to: number): RouteProgress | null => {
    let best: RouteProgress | null = null;
    for (let i = Math.max(0, from); i < Math.min(route.length - 1, to); i++) {
      const d = distPointToSegmentM(point, route[i]!, route[i + 1]!);
      if (!best || d < best.distanceToRouteM) {
        // Segment üzerindeki izdüşüm: başlangıç noktasına olan uzaklıkla kabaca oranla.
        const a = haversineM(route[i]!, point);
        const segLen = cumulative[i + 1]! - cumulative[i]!;
        const along = Math.min(segLen, Math.sqrt(Math.max(0, a * a - d * d)));
        best = { progressM: cumulative[i]! + along, distanceToRouteM: d, segmentIndex: i };
      }
    }
    return best;
  };
  const windowed = search(lastSegment, lastSegment + window);
  if (windowed && windowed.distanceToRouteM <= 100) return windowed;
  return search(0, route.length) ?? { progressM: 0, distanceToRouteM: Infinity, segmentIndex: 0 };
}

export type OffRouteState = { consecutive: number; off: boolean };

/** Rotadan sapma durumu: 40 m üstü ardışık 3 örnekte sapma ilan edilir; geri dönünce hemen kalkar. */
export function updateOffRoute(
  state: OffRouteState,
  distanceToRouteM: number,
  threshold = OFF_ROUTE_M,
  confirm = OFF_ROUTE_CONFIRM,
): OffRouteState {
  if (distanceToRouteM <= threshold) return { consecutive: 0, off: false };
  const consecutive = state.consecutive + 1;
  return { consecutive, off: consecutive >= confirm };
}

/** Kalan mesafeye ve ortalama tempoya göre tahmini varış zamanı (ms). */
export function estimateArrival(params: {
  now: number;
  remainingM: number;
  paceSecPerKm: number | null;
}): number | null {
  if (!params.paceSecPerKm || params.remainingM <= 0) return null;
  return params.now + (params.remainingM / 1000) * params.paceSecPerKm * 1000;
}

// ---------------------------------------------------------------- biçimleme / konuşma

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 1424 sn → "00:23:44" */
export function formatElapsed(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
}

/** 676 sn/km → "11:16"; veri yoksa "--:--". */
export function formatPaceClock(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm) || secPerKm <= 0 || secPerKm > 3599)
    return '--:--';
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

/** 2100 → "2,1" (km, ondalık ayraç virgül). */
export function formatKmClock(m: number): string {
  return (Math.round(m / 10) / 100).toFixed(2).replace('.', ',');
}

/** 670 sn → "11 dakika 10 saniye"; tam dakikada saniye söylenmez. */
export function spokenDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const parts: string[] = [];
  if (m > 0) parts.push(tr.spoken.minutes(m));
  if (r > 0 || m === 0) parts.push(tr.spoken.seconds(r));
  return parts.join(' ');
}

/** 3800 → "3,8 kilometre"; 850 → "850 metre". */
export function spokenDistance(m: number): string {
  if (m < 1000) return tr.spoken.meters(Math.max(0, Math.round(m / 10) * 10));
  const km = Math.round(m / 100) / 10;
  return tr.spoken.kilometers(String(km).replace('.', ','));
}

/** Her km'de okunan metin: "1 kilometre tamamlandı. Tempon 11 dakika 10 saniye. Kalan 3,8 kilometre." */
export function buildKmAnnouncement(params: {
  km: number;
  paceSecPerKm: number | null;
  remainingM: number | null;
}): string {
  const parts = [tr.spoken.kmDone(params.km)];
  if (params.paceSecPerKm) parts.push(tr.spoken.yourPace(spokenDuration(params.paceSecPerKm)));
  if (params.remainingM !== null && params.remainingM > 0) {
    parts.push(tr.spoken.remaining(spokenDistance(params.remainingM)));
  }
  return parts.join(' ');
}
