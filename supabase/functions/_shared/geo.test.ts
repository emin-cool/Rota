import {
  bboxAreaKm2,
  bboxOf,
  cellKeys,
  destinationPoint,
  distPointToSegmentM,
  haversineM,
  lineLengthM,
  mirrorRoute,
  overlapRatio,
  pointInRing,
  resample,
} from './geo.ts';
import type { Coord3, LngLat } from './types.ts';

// 41°N'de ~0,001° enlem ≈ 110 m.
const north = (lat: number, z = 0): Coord3 => [29, lat, z];

describe('mesafe', () => {
  it('haversine ve çizgi uzunluğu', () => {
    expect(haversineM([29, 41], [29, 42])).toBeGreaterThan(110_000);
    expect(lineLengthM([north(41), north(41.01), north(41.02)])).toBeCloseTo(
      haversineM([29, 41], [29, 41.02]),
      0,
    );
  });
  it('destinationPoint: kuzeye 1 km ≈ 0,009° enlem', () => {
    const p = destinationPoint([29, 41], 0, 1000);
    expect(p[0]).toBeCloseTo(29, 5);
    expect(p[1] - 41).toBeCloseTo(0.009, 3);
    expect(haversineM([29, 41], p)).toBeCloseTo(1000, -1);
  });
});

describe('resample', () => {
  const line = [north(41, 0), north(41.01, 10), north(41.02, 30)];
  it('başlangıç, her adım ve bitişi içerir; rakımı yumuşakça interpole eder', () => {
    const s = resample(line, 100);
    expect(s[0]!.d).toBe(0);
    expect(s[0]!.z).toBe(0);
    expect(s[s.length - 1]!.d).toBeCloseTo(lineLengthM(line), 0);
    expect(s[s.length - 1]!.z).toBeCloseTo(30, 5);
    expect(s[1]!.d).toBeCloseTo(100, 5);
  });
  it('kısa çizgide başlangıç ve bitiş korunur', () => {
    const s = resample([north(41), north(41.0003)], 100);
    expect(s).toHaveLength(2);
    expect(s[0]!.d).toBe(0);
  });
  it('tek nokta ve boş girdi', () => {
    expect(resample([north(41)], 100)).toHaveLength(1);
    expect(resample([], 100)).toEqual([]);
  });
});

describe('nokta–çizgi', () => {
  it('segmente dik mesafe ve uç noktalar', () => {
    const a: LngLat = [29, 41];
    const b: LngLat = [29, 41.01]; // kuzey-güney çizgi
    // 0,0005° doğuda (~42 m) bir nokta
    expect(distPointToSegmentM([29.0005, 41.005], a, b)).toBeGreaterThan(40);
    expect(distPointToSegmentM([29.0005, 41.005], a, b)).toBeLessThan(45);
    // Çizginin ucunun ötesinde: uç noktaya mesafe
    expect(distPointToSegmentM([29, 41.02], a, b)).toBeCloseTo(haversineM([29, 41.02], b), -1);
  });
  it('çokgen içinde mi', () => {
    const ring: LngLat[] = [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ];
    expect(pointInRing([0.5, 0.5], ring)).toBe(true);
    expect(pointInRing([1.5, 0.5], ring)).toBe(false);
  });
});

describe('bbox', () => {
  it('tampon ve alan', () => {
    const b = bboxOf(
      [
        [29, 41],
        [29.02, 41.02],
      ],
      50,
    );
    expect(b.south).toBeLessThan(41);
    expect(b.north).toBeGreaterThan(41.02);
    expect(bboxAreaKm2(b)).toBeGreaterThan(4);
    expect(bboxAreaKm2(b)).toBeLessThan(6);
  });
});

describe('gidiş-dönüş ve çakışma', () => {
  it('mirrorRoute rotayı geri sarar', () => {
    const out = mirrorRoute([north(41, 1), north(41.01, 5), north(41.02, 9)]);
    expect(out).toHaveLength(5);
    expect(out[out.length - 1]).toEqual(north(41, 1));
    expect(out[2]).toEqual(north(41.02, 9));
  });
  it('overlapRatio: aynı rota 1, farklı rota 0', () => {
    const a = cellKeys([north(41), north(41.01)]);
    const b = cellKeys([
      [29.05, 41],
      [29.05, 41.01],
    ]);
    expect(overlapRatio(a, a)).toBe(1);
    expect(overlapRatio(a, b)).toBe(0);
    expect(overlapRatio(new Set(), a)).toBe(0);
  });
});
