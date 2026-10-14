import {
  bearingDeg,
  formatDistance,
  formatDuration,
  formatRating,
  haversineM,
  lineLengthM,
  lineMidpoint,
  type LngLat,
  unwrapHeading,
} from './geo';

describe('haversineM', () => {
  it('aynı nokta için 0', () => {
    expect(haversineM([29, 41], [29, 41])).toBe(0);
  });
  it('1 derece enlem ≈ 111 km', () => {
    expect(haversineM([29, 41], [29, 42])).toBeGreaterThan(110_000);
    expect(haversineM([29, 41], [29, 42])).toBeLessThan(112_000);
  });
});

describe('lineMidpoint', () => {
  it('düz çizgide ortayı bulur', () => {
    const mid = lineMidpoint([
      [29, 41],
      [29, 41.02],
    ])!;
    expect(mid[0]).toBeCloseTo(29, 6);
    expect(mid[1]).toBeCloseTo(41.01, 4);
  });
  it('eşit olmayan parçalarda yolun yarısını bulur', () => {
    const line: LngLat[] = [
      [29, 41],
      [29, 41.01],
      [29, 41.03],
    ];
    const mid = lineMidpoint(line)!;
    expect(mid[1]).toBeCloseTo(41.015, 3);
    expect(haversineM(line[0]!, mid)).toBeCloseTo(lineLengthM(line) / 2, -1);
  });
  it('boş ve tek noktalı çizgi', () => {
    expect(lineMidpoint([])).toBeNull();
    expect(lineMidpoint([[29, 41]])).toEqual([29, 41]);
  });
});

describe('biçimleme', () => {
  it('mesafe virgüllü km', () => {
    expect(formatDistance(4800)).toBe('4,8 km');
    expect(formatDistance(6200)).toBe('6,2 km');
    expect(formatDistance(10_000)).toBe('10 km');
    expect(formatDistance(850)).toBe('850 m');
  });
  it('süre', () => {
    expect(formatDuration(45)).toBe('45 dk');
    expect(formatDuration(60)).toBe('1 sa');
    expect(formatDuration(80)).toBe('1 sa 20 dk');
  });
  it('puan', () => {
    expect(formatRating(4.7)).toBe('4,7');
    expect(formatRating(5)).toBe('5,0');
  });
});

describe('bearingDeg', () => {
  const o: LngLat = [29, 41];
  it('kuzey, doğu, güney, batı', () => {
    expect(bearingDeg(o, [29, 41.01])).toBeCloseTo(0, 0);
    expect(bearingDeg(o, [29.01, 41])).toBeCloseTo(90, 0);
    expect(bearingDeg(o, [29, 40.99])).toBeCloseTo(180, 0);
    expect(bearingDeg(o, [28.99, 41])).toBeCloseTo(270, 0);
  });
  it('kuzeydoğu yaklaşık 45° civarında', () => {
    const b = bearingDeg(o, [29.01, 41.01]);
    expect(b).toBeGreaterThan(35);
    expect(b).toBeLessThan(55);
  });
});

describe('unwrapHeading', () => {
  it('küçük farkı olduğu gibi ekler', () => {
    expect(unwrapHeading(90, 100)).toBe(100);
  });
  it('359° → 1° geçişinde en kısa yolu seçer', () => {
    expect(unwrapHeading(359, 1)).toBe(361);
  });
  it('1° → 359° geçişinde geriye döner', () => {
    expect(unwrapHeading(1, 359)).toBe(-1);
  });
  it('180° farkta tutarlı bir yön seçer', () => {
    expect(Math.abs(unwrapHeading(0, 180))).toBe(180);
  });
});
