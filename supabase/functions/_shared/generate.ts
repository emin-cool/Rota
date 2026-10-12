import { errors } from './errors.ts';
import { bboxAreaKm2, bboxOf, resample, type BBox } from './geo.ts';
import { pickAndLabel } from './labeling.ts';
import type { OsmFeature } from './osm.ts';
import { categoriesPerSample, poisNearRoute } from './osm.ts';
import { buildOrsRequests, dedupeCandidates, type Candidate, type OrsRequest } from './ors.ts';
import {
  DISTANCE_TOLERANCE,
  durationToDistanceM,
  estimateDurationMin,
  withinTolerance,
} from './pace.ts';
import type { ParsedInput } from './schema.ts';
import {
  BUFFER_M,
  NEUTRAL_SCENIC,
  SAMPLE_STEP_M,
  ascentFromSamples,
  breakBonus,
  distancePenalty,
  mainRoadShare,
  scenicScore,
  slopePenalty,
  steepSegmentCount,
  surfacePenalty,
  totalScore,
  trafficPenalty,
} from './scoring.ts';
import type { LngLat, RouteOption } from './types.ts';

/** Dış servisler; testlerde sahte olanlar verilir. */
export type Deps = {
  fetchCandidates: (requests: OrsRequest[]) => Promise<Candidate[]>;
  fetchFeatures: (bbox: BBox) => Promise<OsmFeature[]>;
  /** Tanı satırları (debug). */
  log?: (message: string) => void;
};

/** Overpass bbox'ı bundan büyükse sorgu atlanır (çok büyük/yavaş olur). */
export const MAX_SCENERY_BBOX_KM2 = 400;
/** İlk tolerans ±%10; hiç aday kalmazsa ±%20'ye gevşetilir. */
const RELAXED_TOLERANCE = 0.2;
const MAX_PROFILE_POINTS = 300;
const MAX_RETUNE_ROUNDS = 3;
const MAX_RETUNES_PER_ROUND = 4;

/** Hedef mesafe (m): loop/out_back için süre ya da mesafeden; A→B'de hedef yok. */
export function targetDistanceM(input: ParsedInput): number | null {
  if (input.routeType === 'a_b') return null;
  if (input.distanceM !== undefined) return Math.round(input.distanceM);
  return durationToDistanceM(
    input.activityType,
    input.durationMin!,
    input.slope,
    input.paceSecPerKm,
  );
}

/**
 * Hedef mesafeye uyan adaylar: önce ±%10 (docs). Üçten azsa, kalan boşluklar ±%20 içindeki en yakın
 * adaylarla doldurulur ki kullanıcı en az (mümkünse) 3 seçenek görsün; mesafe sapması zaten skorda cezalanır.
 */
export function filterByTolerance(
  candidates: Candidate[],
  targetM: number | null,
  wanted = 3,
): Candidate[] {
  if (targetM === null) return candidates;
  const strict = candidates.filter((c) =>
    withinTolerance(c.distanceM, targetM, DISTANCE_TOLERANCE),
  );
  if (strict.length >= wanted) return strict;
  const relaxed = candidates
    .filter((c) => !strict.includes(c) && withinTolerance(c.distanceM, targetM, RELAXED_TOLERANCE))
    .sort((a, b) => Math.abs(a.distanceM - targetM) - Math.abs(b.distanceM - targetM));
  return strict.concat(relaxed.slice(0, wanted - strict.length));
}

type Scored = {
  candidate: Candidate;
  scenic: number;
  total: number;
  ascentM: number;
  distanceM: number;
  samples: ReturnType<typeof resample>;
  pois: RouteOption['pois'];
};

function scoreCandidate(
  c: Candidate,
  input: ParsedInput,
  targetM: number | null,
  features: OsmFeature[] | null,
): Scored {
  const samples = resample(c.coords, SAMPLE_STEP_M);
  const hits = features ? categoriesPerSample(samples, features) : [];
  const pois = features ? poisNearRoute(samples, features) : [];

  const scenic = features ? scenicScore(hits, input.scenery) : NEUTRAL_SCENIC;
  const ascentM = c.ascentM > 0 ? c.ascentM : ascentFromSamples(samples);
  const amenityCount = pois.filter((p) => p.type === 'water' || p.type === 'toilet').length;

  const total = totalScore({
    scenic,
    slope: slopePenalty(input.slope, steepSegmentCount(samples), ascentM),
    traffic: trafficPenalty(input.extras.avoidTraffic, mainRoadShare(hits)),
    distance: distancePenalty(c.distanceM, targetM),
    surface: surfacePenalty(input.extras.surface, c.unpavedShare),
    bonus: breakBonus(input.extras.amenities, amenityCount),
  });
  return { candidate: c, scenic, total, ascentM, distanceM: c.distanceM, samples, pois };
}

function toRouteOption(label: string, s: Scored, input: ParsedInput): RouteOption {
  const stride = Math.max(1, Math.ceil(s.samples.length / MAX_PROFILE_POINTS));
  const profile = s.samples
    .filter((_, i) => i % stride === 0 || i === s.samples.length - 1)
    .map((p) => ({ d: Math.round(p.d), z: Math.round(p.z * 10) / 10 }));
  const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

  return {
    label,
    geojson: {
      type: 'LineString',
      coordinates: s.candidate.coords.map((c): LngLat => [round5(c[0]), round5(c[1])]),
    },
    distanceM: s.distanceM,
    estDurationMin: estimateDurationMin(
      input.activityType,
      s.distanceM,
      s.ascentM,
      input.paceSecPerKm,
    ),
    elevationGainM: s.ascentM,
    elevationProfile: profile,
    scenicScore: s.scenic,
    pois: s.pois,
  };
}

/** docs/03 "Rota üretim akışı" 2–6. adımlar. (Cache ve JWT dışarıda, index.ts'te.) */
export async function generate(
  input: ParsedInput,
  deps: Deps,
): Promise<{ routes: RouteOption[]; warnings: string[] }> {
  const targetM = targetDistanceM(input);
  const requests = buildOrsRequests(input, targetM);

  let fetched = await deps.fetchCandidates(requests);

  // ORS hedef uzunluğa uymayabilir: hedef dışı kalanların isteğini ölçekleyip yeniden sor (en çok 2 tur).
  let pending = fetched;
  for (let round = 1; round <= MAX_RETUNE_ROUNDS && targetM !== null; round++) {
    // ORS ücretsiz kotası (dakikada 40 istek) tükenmesin: her turda hedefe en yakın en çok 4 aday ölçeklenir.
    const retries = pending
      .filter((c) => c.source?.retune && !withinTolerance(c.distanceM, targetM, DISTANCE_TOLERANCE))
      .sort(
        (a, b) =>
          Math.abs(Math.log(targetM / a.distanceM)) - Math.abs(Math.log(targetM / b.distanceM)),
      )
      .slice(0, MAX_RETUNES_PER_ROUND)
      .map((c) => c.source!.retune!(targetM / c.distanceM));
    if (retries.length === 0) break;
    deps.log?.(`yeniden ölçekleme turu ${round}: ${retries.length} istek`);
    pending = await deps.fetchCandidates(retries).catch(() => []);
    fetched = fetched.concat(pending);
  }
  const deduped = dedupeCandidates(fetched);
  const candidates = filterByTolerance(deduped, targetM);
  deps.log?.(
    `hedef ${targetM ?? '-'} m | istek ${requests.length} | ORS adayı ${fetched.length} | tekrarsız ${deduped.length} | tolerans sonrası ${candidates.length}`,
  );
  deps.log?.(
    `adaylar: ${deduped.map((c) => `${(c.distanceM / 1000).toFixed(1)}km/+${c.ascentM}m`).join(', ')}`,
  );
  if (candidates.length === 0) throw errors.noRoutes();

  // Tüm adaylar için tek Overpass sorgusu.
  const warnings: string[] = [];
  let features: OsmFeature[] | null = null;
  const bbox = bboxOf(
    candidates.flatMap((c) => c.coords.map((p): LngLat => [p[0], p[1]])),
    BUFFER_M,
  );
  if (bboxAreaKm2(bbox) <= MAX_SCENERY_BBOX_KM2) {
    try {
      features = await deps.fetchFeatures(bbox);
    } catch (e) {
      deps.log?.(`Overpass başarısız: ${e instanceof Error ? e.message : String(e)}`);
      warnings.push('scenery_unavailable');
    }
  } else {
    deps.log?.(
      `Manzara verisi atlandı: bbox ${bboxAreaKm2(bbox).toFixed(0)} km² (> ${MAX_SCENERY_BBOX_KM2})`,
    );
    warnings.push('scenery_unavailable');
  }

  const scored = candidates.map((c) => scoreCandidate(c, input, targetM, features));
  const labeled = pickAndLabel(scored);
  return {
    routes: labeled.map(({ label, item }) => toRouteOption(label, item, input)),
    warnings,
  };
}
