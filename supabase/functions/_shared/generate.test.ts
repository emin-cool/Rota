import { canonicalInput } from './cacheKey.ts';
import { AppError } from './errors.ts';
import { filterByTolerance, generate, targetDistanceM, type Deps } from './generate.ts';
import { destinationPoint, haversineM, lineLengthM } from './geo.ts';
import {
  buildOrsRequests,
  dedupeCandidates,
  loopWaypoints,
  mapOrsError,
  orsProfile,
  toCandidate,
  type Candidate,
} from './ors.ts';
import { parseOverpass } from './osm.ts';
import { inputSchema, type ParsedInput } from './schema.ts';
import type { Coord3, LngLat } from './types.ts';

const EMIRGAN: LngLat = [29.056, 41.108];

const parse = (raw: unknown): ParsedInput => inputSchema.parse(raw);
const loopInput = (extra: Record<string, unknown> = {}) =>
  parse({
    activityType: 'walk',
    routeType: 'loop',
    start: EMIRGAN,
    durationMin: 60,
    scenery: ['coast'],
    slope: 'flat',
    ...extra,
  });

/** Başlangıçtan `bearing` yönünde `lengthM` uzunlukta düz bir aday (gidiş + dönüş aynı yol). */
function candidate(bearing: number, lengthM: number, climb = 0): Candidate {
  const far = destinationPoint(EMIRGAN, bearing, lengthM / 2);
  const coords: Coord3[] = [
    [EMIRGAN[0], EMIRGAN[1], 0],
    [far[0], far[1], climb],
    [EMIRGAN[0], EMIRGAN[1], 0],
  ];
  return { coords, distanceM: Math.round(lengthM), ascentM: climb, unpavedShare: 0 };
}

describe('inputSchema', () => {
  it('varsayılanları uygular', () => {
    const p = parse({ activityType: 'walk', routeType: 'loop', start: EMIRGAN, durationMin: 60 });
    expect(p.scenery).toEqual(['any']);
    expect(p.slope).toBe('some');
    expect(p.extras).toEqual({});
  });
  it('A→B için bitiş, dönüşlüde süre/mesafe zorunlu', () => {
    expect(
      inputSchema.safeParse({ activityType: 'walk', routeType: 'a_b', start: EMIRGAN }).success,
    ).toBe(false);
    expect(
      inputSchema.safeParse({ activityType: 'walk', routeType: 'loop', start: EMIRGAN }).success,
    ).toBe(false);
    expect(
      inputSchema.safeParse({
        activityType: 'walk',
        routeType: 'a_b',
        start: EMIRGAN,
        end: [29.04, 41.07],
      }).success,
    ).toBe(true);
  });
  it('geçersiz koordinat ve bilinmeyen alanları reddeder', () => {
    expect(
      inputSchema.safeParse({
        activityType: 'walk',
        routeType: 'loop',
        start: [200, 41],
        durationMin: 60,
      }).success,
    ).toBe(false);
    expect(
      inputSchema.safeParse({
        activityType: 'walk',
        routeType: 'loop',
        start: EMIRGAN,
        durationMin: 60,
        extras: { foo: true },
      }).success,
    ).toBe(false);
  });
});

describe('canonicalInput (önbellek anahtarı)', () => {
  it('başlangıcı ~100 m’ye yuvarlar: yakın noktalar aynı anahtarı üretir', () => {
    const a = canonicalInput(loopInput());
    const b = canonicalInput(loopInput({ start: [29.0562, 41.1083] }));
    expect(b).toEqual(a);
    expect(canonicalInput(loopInput({ start: [29.07, 41.108] }))).not.toEqual(a);
  });
  it('alan sırası ve false/any ekstralar etkilemez; tempo yalnızca koşuda önemli', () => {
    expect(canonicalInput(loopInput({ extras: { dog: false, surface: 'any' } }))).toEqual(
      canonicalInput(loopInput()),
    );
    expect(canonicalInput(loopInput({ paceSecPerKm: 300 }))).toEqual(canonicalInput(loopInput()));
    expect(canonicalInput(loopInput({ activityType: 'run', paceSecPerKm: 300 }))).not.toEqual(
      canonicalInput(loopInput({ activityType: 'run', paceSecPerKm: 400 })),
    );
  });
});

describe('buildOrsRequests', () => {
  it('loop: başlangıçtan geçen daire üzerinde 8 ara noktalı döngü isteği', () => {
    const reqs = buildOrsRequests(loopInput(), 4300);
    expect(reqs).toHaveLength(8);
    for (const r of reqs) {
      const coords = r.body.coordinates as LngLat[];
      expect(coords.length).toBeGreaterThanOrEqual(4); // başlangıç + 2–3 ara nokta + başlangıç
      expect(coords[0]).toEqual(EMIRGAN);
      expect(coords[coords.length - 1]).toEqual(EMIRGAN);
      expect(r.mirror).toBe(false);
      expect(typeof r.retune).toBe('function');
    }
    // Farklı yönler → farklı ilk ara noktalar
    const firstWaypoints = new Set(reqs.map((r) => (r.body.coordinates as LngLat[])[1]!.join(',')));
    expect(firstWaypoints.size).toBe(8);
    expect(reqs[0]!.body).toMatchObject({
      elevation: true,
      extra_info: ['steepness', 'surface', 'waytype'],
    });
    expect(reqs[0]!.profile).toBe('foot-walking');
  });
  it('loopWaypoints: tüm noktalar aynı daire üzerinde; retune mesafeyi doğrusal ölçekler', () => {
    const pts = loopWaypoints(EMIRGAN, 0, 4, 1000);
    expect(pts).toHaveLength(5);
    const center = destinationPoint(EMIRGAN, 0, 1000);
    for (const p of pts.slice(0, 4)) expect(haversineM(center, p)).toBeCloseTo(1000, -1);
    const req = buildOrsRequests(loopInput(), 4300)[0]!;
    const perimeter = (r: typeof req) => lineLengthM(r.body.coordinates as LngLat[]);
    expect(perimeter(req.retune!(2)) / perimeter(req)).toBeCloseTo(2, 1);
  });
  it('a_b: alternative_routes + en kısa', () => {
    const reqs = buildOrsRequests(
      parse({ activityType: 'bike', routeType: 'a_b', start: EMIRGAN, end: [29.04, 41.07] }),
      null,
    );
    expect(reqs).toHaveLength(2);
    expect(reqs[0]!.body.alternative_routes).toMatchObject({ target_count: 3 });
    expect(reqs[1]!.body.preference).toBe('shortest');
    expect(reqs[0]!.profile).toBe('cycling-regular');
  });
  it('out_back: 6 yön, mirror; hedef noktaları gidiş mesafesinin yarısı kadar uzakta', () => {
    const reqs = buildOrsRequests(loopInput({ routeType: 'out_back' }), 6000);
    expect(reqs).toHaveLength(6);
    expect(reqs.every((r) => r.mirror)).toBe(true);
    const [start, dest] = reqs[0]!.body.coordinates as LngLat[];
    expect(haversineM(start!, dest!)).toBeCloseTo(6000 / 2 / 1.3, -1);
  });
  it('profil ve kısıtlar', () => {
    expect(orsProfile('walk', 'unpaved')).toBe('foot-hiking');
    expect(orsProfile('bike', 'unpaved')).toBe('cycling-mountain');
    const reqs = buildOrsRequests(loopInput({ extras: { stroller: true } }), 4000);
    expect((reqs[0]!.body.options as { avoid_features: string[] }).avoid_features).toEqual([
      'steps',
    ]);
  });
});

describe('toCandidate', () => {
  const feature = {
    geometry: {
      coordinates: [
        [29, 41, 5],
        [29, 41.01, 25],
      ],
    },
    properties: {
      summary: { distance: 1112, duration: 800 },
      ascent: 20,
      descent: 3,
      extras: { surface: { values: [[0, 1, 11]] as [number, number, number][] } },
    },
  };
  it('düz rota', () => {
    const c = toCandidate(feature, false);
    expect(c).toMatchObject({ distanceM: 1112, ascentM: 20, unpavedShare: 1 });
    expect(c.coords).toHaveLength(2);
  });
  it('gidiş-dönüş: mesafe ×2, dönüşte inişler tırmanışa eklenir', () => {
    const c = toCandidate(feature, true);
    expect(c.distanceM).toBe(2224);
    expect(c.ascentM).toBe(23);
    expect(c.coords).toHaveLength(3);
  });
});

describe('filtre ve tekrar eleme', () => {
  it('±%10 yeterliyse yalnızca onlar; üçten azsa ±%20 ile doldurulur', () => {
    const a = candidate(0, 4300);
    const b = candidate(90, 5000); // +%16
    const c = candidate(180, 4000); // −%7 (±%10 içinde)
    const d = candidate(270, 6000); // +%40 (hiçbir zaman)
    // 1 yakın + 1 geniş + 1 çok uzak: ±%10 → [a,c], boşluk ±%20 ile b'den dolar, d girmez
    expect(filterByTolerance([a, b, c, d], 4300)).toEqual([a, c, b]);
    // ±%10 içinde 3 aday varsa ±%20'lere bakılmaz
    const e = candidate(45, 4350);
    expect(filterByTolerance([a, c, e, b], 4300)).toEqual([a, c, e]);
    expect(filterByTolerance([candidate(0, 6000)], 4300)).toEqual([]);
    expect(filterByTolerance([a, b], null)).toHaveLength(2);
  });
  it('aynı yolu izleyen adayları eler', () => {
    const a = candidate(0, 4300);
    const same = { ...candidate(0, 4300) };
    const other = candidate(120, 4300);
    expect(dedupeCandidates([a, same, other])).toHaveLength(2);
  });
});

describe('hedef mesafe', () => {
  it('süreden, açık mesafeden; A→B’de yok', () => {
    expect(targetDistanceM(loopInput())).toBeGreaterThan(4000);
    expect(targetDistanceM(loopInput({ durationMin: undefined, distanceM: 5000 }))).toBe(5000);
    expect(
      targetDistanceM(
        parse({ activityType: 'walk', routeType: 'a_b', start: EMIRGAN, end: [29, 41] }),
      ),
    ).toBeNull();
  });
});

describe('mapOrsError', () => {
  it('Türkçe uygulama hataları', () => {
    expect((mapOrsError(429, '{}') as AppError).code).toBe('upstream_busy');
    expect((mapOrsError(404, '{"error":{"code":2010}}') as AppError).code).toBe(
      'start_not_routable',
    );
    expect((mapOrsError(500, 'x') as AppError).code).toBe('upstream_unavailable');
  });
});

describe('generate (uçtan uca, sahte ORS/Overpass)', () => {
  const target = targetDistanceM(loopInput())!;
  const candidates = [
    candidate(0, target, 30),
    candidate(60, target * 1.05, 5),
    candidate(120, target * 0.95, 12),
    candidate(180, target, 2),
    candidate(240, target * 1.02, 40),
    candidate(300, target * 3, 0), // tolerans dışı
  ];

  const coastLine = {
    type: 'way' as const,
    tags: { natural: 'coastline' },
    // 0° yönündeki (kuzey) adayın hemen yanından geçen kıyı
    geometry: [
      { lat: 41.108, lon: EMIRGAN[0] + 0.0003 },
      { lat: 41.13, lon: EMIRGAN[0] + 0.0003 },
    ],
  };

  it('3 rota döndürür, etiketler farklı, tolerans dışı aday elenir', async () => {
    const deps: Deps = {
      fetchCandidates: async () => candidates,
      fetchFeatures: async () => parseOverpass({ elements: [coastLine] }),
    };
    const { routes, warnings } = await generate(loopInput(), deps);
    expect(warnings).toEqual([]);
    expect(routes).toHaveLength(3);
    expect(new Set(routes.map((r) => r.label)).size).toBe(3);
    expect(routes.map((r) => r.label)).toEqual(['En manzaralı', 'En düz', 'En kısa']);
    for (const r of routes) {
      expect(Math.abs(r.distanceM - target)).toBeLessThanOrEqual(target * 0.1);
      expect(r.geojson.type).toBe('LineString');
      expect(r.elevationProfile[0]!.d).toBe(0);
      expect(r.estDurationMin).toBeGreaterThan(0);
      expect(r.scenicScore).toBeGreaterThanOrEqual(0);
      expect(r.scenicScore).toBeLessThanOrEqual(100);
    }
    // Kıyıyı izleyen (0°) aday en manzaralı olmalı.
    expect(routes[0]!.scenicScore).toBeGreaterThan(routes[1]!.scenicScore);
    expect(routes[0]!.geojson.coordinates[1]![0]).toBeCloseTo(EMIRGAN[0], 3);
  });

  it('Overpass hata verirse rotalar yine döner, uyarı eklenir, skor nötr', async () => {
    const deps: Deps = {
      fetchCandidates: async () => candidates,
      fetchFeatures: async () => {
        throw new Error('Overpass 504');
      },
    };
    const { routes, warnings } = await generate(loopInput(), deps);
    expect(warnings).toEqual(['scenery_unavailable']);
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((r) => r.scenicScore === 50)).toBe(true);
  });

  it('uygun aday yoksa no_routes', async () => {
    const deps: Deps = {
      fetchCandidates: async () => [candidate(0, target * 3)],
      fetchFeatures: async () => [],
    };
    await expect(generate(loopInput(), deps)).rejects.toMatchObject({ code: 'no_routes' });
  });
});

describe('ORS hedefe uymazsa yeniden ölçekleme', () => {
  const target = targetDistanceM(loopInput())!;

  /** ORS'i taklit eder: yol uzunluğu = ara noktaların çevresi × 2,7 (hedefin çok üstünde). */
  const overshootingOrs = () => {
    const calls: number[] = [];
    const fetchCandidates: Deps['fetchCandidates'] = async (requests) => {
      calls.push(requests.length);
      return requests.map((r, i) => {
        const length = lineLengthM(r.body.coordinates as LngLat[]) * 2.7;
        return { ...candidate(i * 45, length), source: r };
      });
    };
    return { fetchCandidates, calls };
  };

  it('ilk tur hedef dışındaysa isteği ölçekleyip hedefe yaklaştırır', async () => {
    const { fetchCandidates, calls } = overshootingOrs();
    const { routes } = await generate(loopInput(), {
      fetchCandidates,
      fetchFeatures: async () => [],
    });
    expect(calls.length).toBeGreaterThanOrEqual(2); // 8 ilk istek + yeniden denemeler
    expect(routes).toHaveLength(3);
    for (const r of routes) {
      expect(Math.abs(r.distanceM - target)).toBeLessThanOrEqual(target * 0.1);
    }
  });

  it('A→B’de (ölçeklenemez) yeniden deneme yapılmaz', async () => {
    let calls = 0;
    const input = parse({
      activityType: 'walk',
      routeType: 'a_b',
      start: EMIRGAN,
      end: [29.04, 41.07],
    });
    await generate(input, {
      fetchCandidates: async () => {
        calls++;
        return [candidate(0, 3000)];
      },
      fetchFeatures: async () => [],
    });
    expect(calls).toBe(1);
  });
});
