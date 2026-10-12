import {
  ascentFromSamples,
  breakBonus,
  distancePenalty,
  mainRoadShare,
  sampleScore,
  scaleScenic,
  scenicScore,
  slopePenalty,
  steepSegmentCount,
  surfacePenalty,
  totalScore,
  trafficPenalty,
  type Category,
} from './scoring.ts';

const hits = (...c: Category[]) => new Set<Category>(c);

describe('sampleScore', () => {
  it('ağırlıklar: sahil +3, park +2, tarihi +1, ana yol −2', () => {
    expect(sampleScore(hits('coast'), ['any'])).toBe(3);
    expect(sampleScore(hits('green'), ['any'])).toBe(2);
    expect(sampleScore(hits('historic'), ['any'])).toBe(1);
    expect(sampleScore(hits('mainRoad'), ['any'])).toBe(-2);
    expect(sampleScore(hits('coast', 'green', 'mainRoad'), ['any'])).toBe(3);
  });
  it('seçilen manzara türü ×2; ana yol cezası katlanmaz', () => {
    expect(sampleScore(hits('coast'), ['coast'])).toBe(6);
    expect(sampleScore(hits('green'), ['coast'])).toBe(2);
    expect(sampleScore(hits('coast', 'mainRoad'), ['coast'])).toBe(4);
  });
  it('hiç kategori yoksa 0', () => {
    expect(sampleScore(hits(), ['coast'])).toBe(0);
  });
});

describe('scaleScenic / scenicScore', () => {
  it('sigmoid: 1 → 50, uçlar 0–100 içinde', () => {
    expect(scaleScenic(1)).toBe(50);
    expect(scaleScenic(3)).toBeGreaterThan(80);
    expect(scaleScenic(-2)).toBeLessThan(10);
    expect(scaleScenic(100)).toBe(100);
    expect(scaleScenic(-100)).toBe(0);
  });
  it('daha çok sahil → daha yüksek skor', () => {
    const coastal = Array.from({ length: 10 }, () => hits('coast'));
    const plain = Array.from({ length: 10 }, () => hits());
    expect(scenicScore(coastal, ['coast'])).toBeGreaterThan(scenicScore(plain, ['coast']));
  });
  it('örnek yoksa nötr 50', () => {
    expect(scenicScore([], ['any'])).toBe(50);
  });
});

describe('mainRoadShare', () => {
  it('ana yoldaki örnek oranı', () => {
    expect(mainRoadShare([hits('mainRoad'), hits(), hits(), hits()])).toBe(0.25);
    expect(mainRoadShare([])).toBe(0);
  });
});

describe('eğim', () => {
  const flat = [0, 100, 200, 300].map((d) => ({ d, point: [29, 41] as [number, number], z: 10 }));
  const steep = [0, 100, 200, 300].map((d, i) => ({
    d,
    point: [29, 41] as [number, number],
    z: i * 8, // 100 m'de 8 m = %8
  }));

  it("%6 üstü her 100 m'lik parçayı sayar", () => {
    expect(steepSegmentCount(flat)).toBe(0);
    expect(steepSegmentCount(steep)).toBe(3);
  });
  it('toplam tırmanış', () => {
    expect(ascentFromSamples(steep)).toBe(24);
    expect(ascentFromSamples(flat)).toBe(0);
  });
  it('düz modda dik parça başına −15; yokuşlu modda ödül (en çok 20)', () => {
    expect(slopePenalty('flat', 3, 24)).toBe(45);
    expect(slopePenalty('hilly', 3, 100)).toBe(-10);
    expect(slopePenalty('hilly', 3, 900)).toBe(-20);
    expect(slopePenalty('some', 3, 100)).toBe(0);
  });
});

describe('diğer cezalar ve bonus', () => {
  it('trafik: ana yol yüzdesi × 0,5', () => {
    expect(trafficPenalty(true, 0.4)).toBe(20);
    expect(trafficPenalty(false, 0.4)).toBe(0);
  });
  it('mesafe sapması: % sapma × 1', () => {
    expect(distancePenalty(4515, 4300)).toBeCloseTo(5, 0);
    expect(distancePenalty(5000, null)).toBe(0);
  });
  it('mola bonusu: çeşme/tuvalet başına +2, en çok +10', () => {
    expect(breakBonus(true, 3)).toBe(6);
    expect(breakBonus(true, 9)).toBe(10);
    expect(breakBonus(false, 9)).toBe(0);
  });
  it('zemin tercihi', () => {
    expect(surfacePenalty('paved', 0.5)).toBe(20);
    expect(surfacePenalty('unpaved', 0.25)).toBe(15);
    expect(surfacePenalty('any', 1)).toBe(0);
  });
  it('toplam skor formülü', () => {
    expect(
      totalScore({ scenic: 80, slope: 15, traffic: 5, distance: 3, surface: 0, bonus: 4 }),
    ).toBe(61);
  });
});
