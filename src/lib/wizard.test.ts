import { buildElevationPaths } from './elevation';
import { parseReverseGeocode } from './geocode';
import {
  DEFAULT_ANSWERS,
  DEFAULT_EXTRAS,
  activeExtraCount,
  buildGenerateInput,
  clampGoalToActivity,
  countPois,
  difficultyOf,
  estimateKm,
  estimateMinutes,
  formatClock,
  formatKmValue,
  matchNearby,
  pickRecommendations,
  quickChipKm,
  relaxSuggestions,
  routeTitle,
  stepDistance,
  stepDuration,
  todaysPick,
  toggleScenery,
  visibleExtraKeys,
  type WizardAnswers,
} from './wizard';
import type { NearbyRoute } from '@/types/database';

const answers = (patch: Partial<WizardAnswers> = {}): WizardAnswers => ({
  ...DEFAULT_ANSWERS,
  start: [29.056, 41.108],
  ...patch,
});

describe('süre ↔ mesafe', () => {
  it('1 saat yürüyüş ≈ 4–4,8 km, eğim düzeltmesiyle yokuşta daha az', () => {
    const flat = estimateKm('walk', 60, 'flat', 390);
    const hilly = estimateKm('walk', 60, 'hilly', 390);
    expect(flat).toBeGreaterThan(4);
    expect(flat).toBeLessThan(4.8);
    expect(hilly).toBeLessThan(flat);
  });
  it('mesafeden süre: 4,8 km düz yürüyüş ≈ 60 dk', () => {
    const min = estimateMinutes('walk', 4.8, 'flat', 390);
    expect(min).toBeGreaterThanOrEqual(60);
    expect(min).toBeLessThanOrEqual(63);
  });
  it('hızlı çip etiketi ve biçimleme', () => {
    expect(quickChipKm(answers(), 60)).toMatch(/^~4,\d km$/);
    expect(formatClock(60)).toBe('1 sa 00 dk');
    expect(formatClock(90)).toBe('1 sa 30 dk');
    expect(formatClock(45)).toBe('45 dk');
    expect(formatKmValue(4.8)).toBe('4,8');
    expect(formatKmValue(5)).toBe('5');
  });
});

describe('adımlar ve sınırlar', () => {
  it('süre 5 dk adımla, sınırlarda durur', () => {
    expect(stepDuration(answers({ durationMin: 60 }), 1)).toBe(65);
    expect(stepDuration(answers({ durationMin: 10 }), -1)).toBe(10);
    expect(stepDuration(answers({ activityType: 'run', durationMin: 180 }), 1)).toBe(180);
  });
  it('mesafe: yürüyüşte 0,5 km, bisiklette 1 km', () => {
    expect(stepDistance(answers({ distanceKm: 5 }), 1)).toBe(5.5);
    expect(stepDistance(answers({ activityType: 'bike', distanceKm: 20 }), -1)).toBe(19);
    expect(stepDistance(answers({ distanceKm: 1 }), -1)).toBe(1);
  });
  it('aktivite değişince hedef yeni sınırlara çekilir', () => {
    const r = clampGoalToActivity(
      answers({ activityType: 'bike', distanceKm: 1, durationMin: 10 }),
    );
    expect(r.distanceKm).toBe(3);
    expect(r.durationMin).toBe(15);
  });
});

describe('buildGenerateInput', () => {
  it('dönüşlü yürüyüş: süre, manzara, eğim; ilgisiz ekstralar çıkarılır', () => {
    const input = buildGenerateInput(
      answers({
        scenery: ['coast'],
        slope: 'flat',
        extras: {
          ...DEFAULT_EXTRAS,
          amenities: true,
          bikeLanes: true,
          transitEnd: true,
          surface: 'paved',
        },
      }),
      null,
    )!;
    expect(input).toMatchObject({
      activityType: 'walk',
      routeType: 'loop',
      start: [29.056, 41.108],
      durationMin: 60,
      scenery: ['coast'],
      slope: 'flat',
      extras: { amenities: true, surface: 'paved' },
    });
    expect(input.extras).not.toHaveProperty('bikeLanes');
    expect(input.extras).not.toHaveProperty('transitEnd');
    expect(input).not.toHaveProperty('end');
    expect(input).not.toHaveProperty('paceSecPerKm');
  });
  it('mesafe hedefi metreye çevrilir; koşuda tempo gönderilir', () => {
    const input = buildGenerateInput(
      answers({ activityType: 'run', goal: 'distance', distanceKm: 7.5, paceSecPerKm: 330 }),
      null,
    )!;
    expect(input.distanceM).toBe(7500);
    expect(input.durationMin).toBeUndefined();
    expect(input.paceSecPerKm).toBe(330);
  });
  it('A→B: bitiş gerekli, hedef gönderilmez', () => {
    expect(buildGenerateInput(answers({ routeType: 'a_b' }), null)).toBeNull();
    const input = buildGenerateInput(answers({ routeType: 'a_b', end: [29.04, 41.07] }), null)!;
    expect(input.end).toEqual([29.04, 41.07]);
    expect(input.durationMin).toBeUndefined();
  });
  it('mevcut konum seçiliyse anlık konum kullanılır; başlangıç yoksa null', () => {
    const cur: [number, number] = [28.99, 41.0];
    expect(buildGenerateInput(answers({ startIsCurrent: true }), cur)!.start).toEqual(cur);
    expect(buildGenerateInput(answers({ startIsCurrent: false }), cur)!.start).toEqual([
      29.056, 41.108,
    ]);
    expect(
      buildGenerateInput({ ...DEFAULT_ANSWERS, start: null, startIsCurrent: false }, cur),
    ).toBeNull();
  });
});

describe('manzara ve ekstralar', () => {
  it('toggleScenery: Fark etmez diğerlerini dışlar; boşalırsa Fark etmez', () => {
    expect(toggleScenery(['any'], 'coast')).toEqual(['coast']);
    expect(toggleScenery(['coast'], 'green')).toEqual(['coast', 'green']);
    expect(toggleScenery(['coast', 'green'], 'coast')).toEqual(['green']);
    expect(toggleScenery(['green'], 'green')).toEqual(['any']);
    expect(toggleScenery(['coast', 'green'], 'any')).toEqual(['any']);
  });
  it('aktivite ve rota tipine göre görünen ekstralar', () => {
    expect(visibleExtraKeys('bike', 'loop')).toEqual([
      'avoidTraffic',
      'litStreets',
      'amenities',
      'bikeLanes',
    ]);
    expect(visibleExtraKeys('walk', 'a_b')).toEqual([
      'avoidTraffic',
      'litStreets',
      'amenities',
      'transitEnd',
      'dog',
      'stroller',
    ]);
    expect(
      activeExtraCount(
        answers({ extras: { ...DEFAULT_EXTRAS, avoidTraffic: true, bikeLanes: true } }),
      ),
    ).toBe(1);
  });
});

describe('relaxSuggestions', () => {
  it('kısıtlayıcı seçimler için en çok 3 öneri, uygulanınca öneri kalmaz', () => {
    const a = answers({
      slope: 'flat',
      scenery: ['coast'],
      durationMin: 30,
      extras: { ...DEFAULT_EXTRAS, amenities: true, surface: 'unpaved' },
    });
    const s = relaxSuggestions(a);
    expect(s).toHaveLength(3);
    expect(s.map((x) => x.id)).toEqual(['slope', 'surface', 'extras']);
  });
  it('varsayılan cevaplarda öneri yok', () => {
    expect(relaxSuggestions(answers())).toEqual([]);
  });
  it('öneri uygulandığında ilgili kriter gevşer', () => {
    const a = answers({
      slope: 'flat',
      extras: { ...DEFAULT_EXTRAS, surface: 'paved', amenities: true },
    });
    const applied = { ...a, ...relaxSuggestions(a).find((x) => x.id === 'surface')!.patch };
    expect(applied.extras.surface).toBe('any');
    expect(applied.extras.amenities).toBe(true);
    const cleared = { ...a, ...relaxSuggestions(a).find((x) => x.id === 'extras')!.patch };
    expect(cleared.extras.amenities).toBe(false);
    expect(cleared.extras.surface).toBe('paved');
  });
});

describe('sonuç yardımcıları', () => {
  it('mola noktası sayımı', () => {
    expect(
      countPois([
        { type: 'water', coord: [1, 1] },
        { type: 'water', coord: [1, 2] },
        { type: 'cafe', coord: [1, 3] },
      ]),
    ).toEqual({
      water: 2,
      toilet: 0,
      cafe: 1,
      pharmacy: 0,
      market: 0,
      hospital: 0,
      transit: 0,
    });
  });
  it('başlık ve zorluk', () => {
    expect(routeTitle({ activityType: 'walk', routeType: 'loop' }, 'Emirgan')).toBe(
      'Emirgan • Dönüşlü yürüyüş',
    );
    expect(routeTitle({ activityType: 'bike', routeType: 'a_b' }, null)).toBe(
      'Seçilen nokta • A → B bisiklet turu',
    );
    expect(difficultyOf(5000, 30)).toBe('easy');
    expect(difficultyOf(5000, 120)).toBe('medium');
    expect(difficultyOf(5000, 300)).toBe('hard');
  });
});

describe('yakındaki rotalardan öneriler', () => {
  const r = (id: string, over: Partial<NearbyRoute>): NearbyRoute => ({
    id,
    title: id,
    activity_type: 'walk',
    route_type: 'loop',
    distance_m: 5000,
    elevation_gain_m: 20,
    est_duration_min: 60,
    scenic_score: 50,
    difficulty: 'easy',
    district: null,
    avg_rating: 4,
    rating_count: 10,
    completion_count: 5,
    is_featured: false,
    start_lng: 29,
    start_lat: 41,
    distance_to_start_m: 100,
    geojson: null,
    ...over,
  });
  const list = [
    r('a', { avg_rating: 4.9, scenic_score: 55, elevation_gain_m: 10 }),
    r('b', { avg_rating: 4.2, scenic_score: 90, elevation_gain_m: 200, is_featured: true }),
    r('c', { avg_rating: 4.5, scenic_score: 70, elevation_gain_m: 15, activity_type: 'run' }),
  ];

  it('eşleşen rotalar: aktivite, manzara ve eğim süzgeçleri', () => {
    expect(matchNearby(list, answers()).map((x) => x.id)).toEqual(['a', 'b']);
    expect(matchNearby(list, answers({ scenery: ['coast'] })).map((x) => x.id)).toEqual(['b']);
    expect(matchNearby(list, answers({ slope: 'flat' })).map((x) => x.id)).toEqual(['a']);
    expect(matchNearby(list, answers({ slope: 'hilly' })).map((x) => x.id)).toEqual(['b']);
  });
  it('günün tavsiyesi: öne çıkan; yoksa en yüksek puan', () => {
    expect(todaysPick(list)!.id).toBe('b');
    expect(todaysPick(list.map((x) => ({ ...x, is_featured: false })))!.id).toBe('a');
    expect(todaysPick([])).toBeNull();
  });
  it('öneri kartları: en iyi puan ve en manzaralı (farklı rota)', () => {
    const { recommended, nature } = pickRecommendations(list);
    expect(recommended!.id).toBe('a');
    expect(nature!.id).toBe('b');
    expect(pickRecommendations([r('x', {})]).nature).toBeNull();
  });
});

describe('buildElevationPaths', () => {
  const profile = [
    { d: 0, z: 10 },
    { d: 500, z: 30 },
    { d: 1000, z: 20 },
  ];
  it('çizgi ve alan yolları üretir', () => {
    const p = buildElevationPaths(profile, 200, 40)!;
    expect(p.line.startsWith('M0.0,')).toBe(true);
    expect(p.area.endsWith('Z')).toBe(true);
    expect(p.minZ).toBe(10);
    expect(p.maxZ).toBe(30);
  });
  it('en yüksek nokta en üstte (küçük y), en alçak nokta altta', () => {
    const p = buildElevationPaths(profile, 200, 40, 4)!;
    const ys = p.line
      .slice(1)
      .split(' L')
      .map((pt) => Number(pt.split(',')[1]));
    expect(ys[1]!).toBeLessThan(ys[0]!);
    expect(ys[1]!).toBeLessThan(ys[2]!);
  });
  it('düz yol ortada düz çizgi; yetersiz veri null', () => {
    const flat = buildElevationPaths(
      [
        { d: 0, z: 5 },
        { d: 100, z: 5 },
      ],
      100,
      40,
      4,
    )!;
    expect(flat.line).toBe('M0.0,20.0 L100.0,20.0');
    expect(buildElevationPaths([{ d: 0, z: 1 }], 100, 40)).toBeNull();
    expect(buildElevationPaths(profile, 0, 40)).toBeNull();
  });
});

describe('parseReverseGeocode', () => {
  it('mahalle > semt > ad önceliği', () => {
    expect(
      parseReverseGeocode({
        features: [
          { properties: { name: 'Sahil Yolu', context: { neighborhood: { name: 'Emirgan' } } } },
        ],
      }),
    ).toBe('Emirgan');
    expect(parseReverseGeocode({ features: [{ properties: { name: 'Sahil Yolu' } }] })).toBe(
      'Sahil Yolu',
    );
    expect(parseReverseGeocode({ features: [] })).toBeNull();
    expect(parseReverseGeocode({})).toBeNull();
  });
});
