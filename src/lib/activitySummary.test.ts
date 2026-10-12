import {
  estimateCalories,
  goalPercent,
  projectTrack,
  simplifyTrack,
  toLineEwkt,
  trackBounds,
} from './activitySummary';
import type { LngLat } from './geo';

describe('estimateCalories', () => {
  it('koşu 5 km, 70 kg → 350 kcal', () => {
    expect(estimateCalories('run', 5000)).toBe(350);
  });
  it('yürüyüş koşudan, bisiklet yürüyüşten az yakar (aynı mesafe)', () => {
    expect(estimateCalories('walk', 5000)).toBeLessThan(estimateCalories('run', 5000));
    expect(estimateCalories('bike', 5000)).toBeLessThan(estimateCalories('walk', 5000));
  });
  it('mesafe 0 → 0', () => {
    expect(estimateCalories('walk', 0)).toBe(0);
  });
});

describe('goalPercent', () => {
  it('5,3 km / 5 km → %106', () => {
    expect(goalPercent(5300, 5000)).toBe(106);
  });
  it('rota yoksa null', () => {
    expect(goalPercent(5000, null)).toBeNull();
    expect(goalPercent(5000, 0)).toBeNull();
  });
});

describe('simplifyTrack', () => {
  it('düz çizgideki ara noktaları atar, uçları korur', () => {
    const line: LngLat[] = Array.from({ length: 50 }, (_, i) => [29 + i * 0.0001, 41]);
    expect(simplifyTrack(line, 3)).toEqual([line[0], line[49]]);
  });
  it('köşeyi korur', () => {
    const l: LngLat[] = [
      [29, 41],
      [29.01, 41],
      [29.01, 41.01],
    ];
    expect(simplifyTrack(l, 3)).toHaveLength(3);
  });
  it('2 noktadan az olanı olduğu gibi döndürür', () => {
    expect(simplifyTrack([[29, 41]])).toEqual([[29, 41]]);
  });
});

describe('toLineEwkt', () => {
  it('SRID ve LINESTRING üretir', () => {
    const l: LngLat[] = [
      [29, 41],
      [29.1, 41.1],
    ];
    expect(toLineEwkt(l)).toBe('SRID=4326;LINESTRING(29 41,29.1 41.1)');
  });
  it('tek nokta → null', () => {
    expect(toLineEwkt([[29, 41]])).toBeNull();
  });
});

describe('projectTrack', () => {
  it('noktalar kutu ve dolgu içinde kalır', () => {
    const l: LngLat[] = [
      [29, 41],
      [29.02, 41.01],
      [29.01, 41.03],
    ];
    for (const [x, y] of projectTrack(l, 300, 400, 20)) {
      expect(x).toBeGreaterThanOrEqual(20 - 1e-6);
      expect(x).toBeLessThanOrEqual(280 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(20 - 1e-6);
      expect(y).toBeLessThanOrEqual(380 + 1e-6);
    }
  });
  it('kuzey ekranda yukarıda (y küçük)', () => {
    const l: LngLat[] = [
      [29, 41],
      [29, 41.01],
    ];
    const [a, b] = projectTrack(l, 100, 100, 10);
    expect(b![1]).toBeLessThan(a![1]);
  });
});

describe('trackBounds', () => {
  it('sınır kutusu', () => {
    const l: LngLat[] = [
      [29, 41],
      [30, 40],
    ];
    expect(trackBounds(l)).toEqual({ sw: [29, 40], ne: [30, 41] });
    expect(trackBounds([])).toBeNull();
  });
});
