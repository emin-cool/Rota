import { errors } from './errors.ts';
import { cellKeys, destinationPoint, mirrorRoute, overlapRatio } from './geo.ts';
import type { ParsedInput } from './schema.ts';
import type { ActivityType, Coord3, LngLat } from './types.ts';

/** Bir ORS isteği + sonucu nasıl işleyeceğimiz. */
export type OrsRequest = {
  profile: string;
  body: Record<string, unknown>;
  /** Gidiş rotasının aynası eklenerek gidiş-dönüş (out_back) yapılır. */
  mirror: boolean;
  /**
   * ORS hedef uzunluğa uymayabilir (round_trip sık sık 2–4 kat uzun döner). Gelen mesafe hedeften
   * sapıyorsa, aynı isteğin uzunluğunu `factor` (= hedef/gelen) kadar ölçekleyip yeniden sormak için.
   */
  retune?: (factor: number) => OrsRequest;
};

/** ORS'den dönen bir rota, bizim sade formda. */
export type Candidate = {
  coords: Coord3[];
  distanceM: number;
  ascentM: number;
  /** 0–1: yolun asfalt dışı payı. */
  unpavedShare: number;
  /** Bu adayı üreten istek (yeniden ölçekleme için). */
  source?: OrsRequest;
};

type OrsFeature = {
  geometry: { coordinates: number[][] };
  properties: {
    summary: { distance: number; duration: number };
    ascent?: number;
    descent?: number;
    extras?: { surface?: { values: [number, number, number][] } };
  };
};

export type OrsResponse = { features?: OrsFeature[] };

/** ORS yüzey kodlarından asfalt dışı olanlar (unknown=0 hariç). */
const UNPAVED_CODES = new Set([2, 8, 9, 10, 11, 12, 15, 16, 17, 18]);

/** Döngü yönleri (başlangıçtan dairenin merkezine) ve çokgenin kenar sayısı (3 = üçgen, 4 = kare). */
const LOOP_BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];
const LOOP_SIDES = [4, 3];
/** İlk tahmin: yol uzunluğu ≈ 7,5 × yarıçap (kare çevresi 5,66R × ~1,3 yol/kuş uçuşu). Sonra ölçeklenir. */
const LOOP_ROAD_PER_RADIUS = 7.5;
const OUT_BACK_BEARINGS = [0, 60, 120, 180, 240, 300];
/** Yol/kuş uçuşu oranı: gidiş mesafesini hedef noktaya çevirirken. */
const CIRCUITY = 1.3;
const EXTRA_INFO = ['steepness', 'surface', 'waytype'];

/**
 * Başlangıçtan geçen, `bearing` yönünde merkezli bir dairenin üzerinde `sides` kenarlı çokgenin
 * köşeleri: [başlangıç, ara noktalar…, başlangıç].
 */
export function loopWaypoints(
  start: LngLat,
  bearing: number,
  sides: number,
  radiusM: number,
): LngLat[] {
  const center = destinationPoint(start, bearing, radiusM);
  const points: LngLat[] = [start];
  for (let k = 1; k < sides; k++) {
    points.push(destinationPoint(center, bearing + 180 + (360 * k) / sides, radiusM));
  }
  points.push(start);
  return points;
}

/** Tek seferde en çok bu kadar ölçeklenir (ORS uçlarda tutarsız davranmasın). */
export const clampFactor = (f: number) => Math.min(2.5, Math.max(0.2, f));

export function orsProfile(activity: ActivityType, surface?: 'paved' | 'unpaved' | 'any'): string {
  if (activity === 'bike') return surface === 'unpaved' ? 'cycling-mountain' : 'cycling-regular';
  return surface === 'unpaved' ? 'foot-hiking' : 'foot-walking';
}

/**
 * Girdiye göre 6–8 aday için ORS isteklerini üretir (docs/03 adım 3):
 * - loop: farklı seed'lerle round_trip
 * - a_b: alternative_routes (≤3) + en kısa tercihli ayrı istek
 * - out_back: farklı yönlere hedef noktası, gidiş rotasının aynası
 */
export function buildOrsRequests(input: ParsedInput, targetM: number | null): OrsRequest[] {
  const profile = orsProfile(input.activityType, input.extras.surface);
  const options: Record<string, unknown> = {};
  if (input.extras.stroller && profile.startsWith('foot')) options.avoid_features = ['steps'];

  const base = {
    elevation: true,
    extra_info: EXTRA_INFO,
    instructions: false,
  };
  const withOptions = (extra: Record<string, unknown>) => ({
    ...(Object.keys(options).length || Object.keys(extra).length
      ? { options: { ...options, ...extra } }
      : {}),
  });

  if (input.routeType === 'loop') {
    // ORS round_trip uzunluğa uymuyor (2–4 kat uzun dönebiliyor). Bunun yerine başlangıçtan geçen bir
    // daire üzerinde 2–3 ara nokta seçip başlangıca dönen normal bir rota isteriz: mesafe yarıçapla
    // neredeyse doğrusal değiştiği için `retune` hedefe hızla yakınsar.
    const makeLoop = (bearing: number, sides: number, radiusM: number): OrsRequest => ({
      profile,
      mirror: false,
      body: {
        ...base,
        coordinates: loopWaypoints(input.start, bearing, sides, radiusM),
        ...withOptions({}),
      },
      retune: (factor) => makeLoop(bearing, sides, radiusM * clampFactor(factor)),
    });
    const radiusM = (targetM ?? 0) / LOOP_ROAD_PER_RADIUS;
    return LOOP_BEARINGS.map((bearing, i) =>
      makeLoop(bearing, LOOP_SIDES[i % LOOP_SIDES.length]!, radiusM),
    );
  }

  if (input.routeType === 'a_b') {
    const coordinates = [input.start, input.end!];
    return [
      {
        profile,
        mirror: false,
        body: {
          ...base,
          coordinates,
          alternative_routes: { target_count: 3, weight_factor: 1.6, share_factor: 0.6 },
          ...withOptions({}),
        },
      },
      {
        profile,
        mirror: false,
        body: { ...base, coordinates, preference: 'shortest', ...withOptions({}) },
      },
    ];
  }

  // out_back
  if (input.end) {
    return [
      {
        profile,
        mirror: true,
        body: { ...base, coordinates: [input.start, input.end], ...withOptions({}) },
      },
    ];
  }
  const makeOut = (bearing: number, outwardM: number): OrsRequest => ({
    profile,
    mirror: true,
    body: {
      ...base,
      coordinates: [input.start, destinationPoint(input.start, bearing, outwardM)],
      ...withOptions({}),
    },
    retune: (factor) => makeOut(bearing, outwardM * clampFactor(factor)),
  });
  const outwardM = (targetM ?? 0) / 2 / CIRCUITY;
  return OUT_BACK_BEARINGS.map((bearing) => makeOut(bearing, outwardM));
}

function unpavedShareOf(f: OrsFeature): number {
  const values = f.properties.extras?.surface?.values;
  const total = f.geometry.coordinates.length - 1;
  if (!values || total <= 0) return 0;
  let unpaved = 0;
  for (const [from, to, code] of values) if (UNPAVED_CODES.has(code)) unpaved += to - from;
  return Math.min(1, unpaved / total);
}

/** ORS GeoJSON özelliğini aday rotaya çevirir; mirror ise gidiş-dönüşe tamamlar. */
export function toCandidate(f: OrsFeature, mirror: boolean, source?: OrsRequest): Candidate {
  const coords: Coord3[] = f.geometry.coordinates.map((c) => [c[0]!, c[1]!, c[2] ?? 0]);
  const ascent = f.properties.ascent ?? 0;
  const descent = f.properties.descent ?? 0;
  if (!mirror) {
    return {
      coords,
      distanceM: Math.round(f.properties.summary.distance),
      ascentM: Math.round(ascent),
      unpavedShare: unpavedShareOf(f),
      source,
    };
  }
  return {
    coords: mirrorRoute(coords),
    distanceM: Math.round(f.properties.summary.distance * 2),
    // Dönüşte inişler tırmanışa döner.
    ascentM: Math.round(ascent + descent),
    unpavedShare: unpavedShareOf(f),
    source,
  };
}

/** Birbirine çok benzeyen (≥%80 örtüşen) adayları ele; ilk gelen kalır. */
export function dedupeCandidates(candidates: Candidate[], threshold = 0.8): Candidate[] {
  const kept: { c: Candidate; keys: Set<string> }[] = [];
  for (const c of candidates) {
    const keys = cellKeys(c.coords);
    if (kept.some((k) => overlapRatio(keys, k.keys) >= threshold)) continue;
    kept.push({ c, keys });
  }
  return kept.map((k) => k.c);
}

/** ORS hata gövdesini kullanıcıya uygun uygulama hatasına çevirir. */
export function mapOrsError(status: number, bodyText: string): Error {
  let code: number | undefined;
  try {
    code = (JSON.parse(bodyText) as { error?: { code?: number } }).error?.code;
  } catch {
    // gövde JSON değil
  }
  if (status === 429) return errors.upstreamBusy();
  // 2010: yakında yönlendirilebilir nokta yok; 404 genellikle aynı sebep.
  if (code === 2010 || status === 404) return errors.startNotRoutable();
  // 2004: mesafe sınırı aşıldı; 2003/2001: geçersiz parametre — bizim hatamız, kullanıcıya genel mesaj.
  return errors.upstreamUnavailable();
}

const ORS_BASE = 'https://api.openrouteservice.org/v2/directions';

async function callOrs(
  req: OrsRequest,
  apiKey: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  log?: (message: string) => void,
): Promise<Candidate[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${ORS_BASE}/${req.profile}/geojson`, {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      log?.(`ORS ${req.profile} HTTP ${res.status}: ${text.slice(0, 240)}`);
      throw mapOrsError(res.status, text);
    }
    const json = JSON.parse(text) as OrsResponse;
    return (json.features ?? []).map((f) => toCandidate(f, req.mirror, req));
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw errors.upstreamUnavailable();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tüm istekleri en çok `concurrency` paralellikle çalıştırır (ORS dakikada 40 istek sınırı).
 * Bazıları başarısız olsa da başarılılar döner; hepsi başarısızsa ilk hata fırlatılır.
 */
export async function fetchOrsCandidates(
  requests: OrsRequest[],
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  concurrency = 4,
  timeoutMs = 20_000,
  log?: (message: string) => void,
): Promise<Candidate[]> {
  const results: Candidate[][] = [];
  const failures: unknown[] = [];
  let next = 0;

  async function worker() {
    while (next < requests.length) {
      const req = requests[next++]!;
      try {
        const started = Date.now();
        const got = await callOrs(req, apiKey, fetchImpl, timeoutMs, log);
        log?.(`ORS ${req.profile}: ${got.length} rota, ${Date.now() - started} ms`);
        results.push(got);
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') log?.('ORS zaman aşımı');
        failures.push(e);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, requests.length) }, worker));

  const all = results.flat();
  if (all.length === 0 && failures.length > 0) throw failures[0];
  return all;
}
