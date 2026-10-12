import { durationToDistanceM, estimateDurationMin, speedKmh, withinTolerance } from './pace.ts';

describe('speedKmh', () => {
  it('yürüyüş 4,8 km/s, bisiklet 16 km/s', () => {
    expect(speedKmh('walk')).toBe(4.8);
    expect(speedKmh('bike')).toBe(16);
  });
  it('koşu tempodan: 6:00 dk/km = 10 km/s; tempo yoksa 6:30', () => {
    expect(speedKmh('run', 360)).toBeCloseTo(10, 5);
    expect(speedKmh('run')).toBeCloseTo(3600 / 390, 5);
  });
});

describe('durationToDistanceM', () => {
  it('düz modda 1 saat yürüyüş ≈ 4,3 km (eğim düzeltmesiyle 4,8 km altında)', () => {
    const d = durationToDistanceM('walk', 60, 'flat');
    expect(d).toBeLessThan(4800);
    expect(d).toBeGreaterThan(4000);
  });
  it('yokuşlu modda aynı süre daha kısa mesafe', () => {
    expect(durationToDistanceM('walk', 60, 'hilly')).toBeLessThan(
      durationToDistanceM('walk', 60, 'flat'),
    );
  });
  it('süre ↔ mesafe tutarlı: hesaplanan mesafe, tahmini süreyi geri verir', () => {
    // flat: 3 m/km tırmanış varsayımı
    const d = durationToDistanceM('walk', 60, 'flat');
    const back = estimateDurationMin('walk', d, (d / 1000) * 3);
    expect(Math.abs(back - 60)).toBeLessThanOrEqual(1);
  });
  it('bisiklet 60 dk ≈ 14–16 km', () => {
    const d = durationToDistanceM('bike', 60, 'flat');
    expect(d).toBeGreaterThan(14000);
    expect(d).toBeLessThan(16000);
  });
});

describe('estimateDurationMin', () => {
  it('her 10 m tırmanış +1 dk', () => {
    expect(estimateDurationMin('walk', 4800, 0)).toBe(60);
    expect(estimateDurationMin('walk', 4800, 100)).toBe(70);
  });
});

describe('withinTolerance', () => {
  it('±%10', () => {
    expect(withinTolerance(4500, 4300)).toBe(true);
    expect(withinTolerance(4800, 4300)).toBe(false);
    expect(withinTolerance(3900, 4300)).toBe(true);
    expect(withinTolerance(3800, 4300)).toBe(false);
  });
});
