import { haversineM, type LngLat } from './geo';
import {
  MAX_ACCURACY_M,
  advanceAlongRoute,
  ascentFromAltitudes,
  buildKmAnnouncement,
  computeStats,
  cumulativeLengths,
  elapsedSeconds,
  estimateArrival,
  formatElapsed,
  formatKmClock,
  formatPaceClock,
  isAcceptable,
  kmMarksCrossed,
  maxSpeedMs,
  pointAlongRoute,
  routeHeadingAt,
  smoothPoints,
  spokenDistance,
  spokenDuration,
  toTrackPoint,
  updateOffRoute,
  type TrackPoint,
} from './tracking';

const T0 = 1_700_000_000_000;
// 41°N'de 0,0001° enlem ≈ 11,1 m
const DEG_PER_M = 1 / 111_195;

/** Kuzeye düz yürüyüş: her `dtS` saniyede `speed` m/s ile bir nokta. */
function walk(n: number, speed = 1.4, dtS = 5, seg = 0, startIndex = 0): TrackPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    lat: 41 + (startIndex + i) * speed * dtS * DEG_PER_M,
    lng: 29,
    alt: 10,
    accuracy: 8,
    ts: T0 + (startIndex + i) * dtS * 1000,
    seg,
  }));
}

describe('doğruluk süzgeci', () => {
  it('25 m üstü ve bilinmeyen doğruluk atılır', () => {
    expect(isAcceptable({ accuracy: 10 })).toBe(true);
    expect(isAcceptable({ accuracy: MAX_ACCURACY_M })).toBe(true);
    expect(isAcceptable({ accuracy: 25.1 })).toBe(false);
    expect(isAcceptable({ accuracy: null })).toBe(false);
  });
  it('toTrackPoint alanları taşır', () => {
    const p = toTrackPoint(
      { coords: { latitude: 41, longitude: 29, altitude: 12, accuracy: 6 }, timestamp: T0 },
      2,
    );
    expect(p).toEqual({ lat: 41, lng: 29, alt: 12, accuracy: 6, ts: T0, seg: 2 });
  });
});

describe('computeStats', () => {
  it('düz yürüyüşte mesafe ve ortalama tempo (≈ 1,4 m/s → ~11:54 dk/km)', () => {
    const pts = walk(121); // 10 dk
    const s = computeStats(pts, 'walk');
    expect(s.distanceM).toBeGreaterThan(830);
    expect(s.distanceM).toBeLessThan(850);
    expect(s.movingSec).toBeCloseTo(600, 0);
    expect(s.avgPaceSecPerKm).toBeGreaterThan(700);
    expect(s.avgPaceSecPerKm).toBeLessThan(730);
    expect(s.currentPaceSecPerKm).toBeCloseTo(s.avgPaceSecPerKm!, -1);
  });

  it('GPS sıçraması (yürüyüşte 5 m/s üstü) mesafeye eklenmez', () => {
    const pts = walk(10);
    pts[5] = { ...pts[5]!, lat: pts[5]!.lat + 500 * DEG_PER_M }; // 500 m sıçrama
    const clean = computeStats(walk(10), 'walk').distanceM;
    const jumpy = computeStats(pts, 'walk').distanceM;
    expect(jumpy).toBeLessThan(clean + 5);
  });

  it('duraklatma bölümleri arasındaki boşluk mesafeye katılmaz', () => {
    const a = walk(5, 1.4, 5, 0);
    // Devam: 100 m ileride, 60 sn sonra, yeni bölüm
    const b = walk(5, 1.4, 5, 1, 5).map((p) => ({
      ...p,
      lat: p.lat + 100 * DEG_PER_M,
      ts: p.ts + 60_000,
    }));
    const stats = computeStats([...a, ...b], 'walk');
    expect(stats.distanceM).toBeLessThan(2 * 4 * 1.4 * 5 + 5); // iki bölümün kendi mesafeleri
  });

  it('duran biri (3 m altı titreşim) mesafe biriktirmez ve hareket süresi sayılmaz', () => {
    const still = Array.from({ length: 30 }, (_, i) => ({
      lat: 41 + (i % 2) * 1 * DEG_PER_M,
      lng: 29,
      alt: 10,
      accuracy: 8,
      ts: T0 + i * 5000,
      seg: 0,
    }));
    const s = computeStats(still, 'walk');
    expect(s.distanceM).toBe(0);
    expect(s.movingSec).toBe(0);
    expect(s.avgPaceSecPerKm).toBeNull();
  });

  it('boş ve tek nokta', () => {
    expect(computeStats([], 'walk').distanceM).toBe(0);
    expect(computeStats(walk(1), 'run').currentPaceSecPerKm).toBeNull();
  });
});

describe('smoothPoints', () => {
  it('uzunluk korunur; titreşim yumuşar; bölüm sınırı aşılmaz', () => {
    const noisy = walk(9).map((p, i) => ({ ...p, lng: 29 + (i % 2 ? 1 : -1) * 4 * DEG_PER_M }));
    const sm = smoothPoints(noisy);
    expect(sm).toHaveLength(noisy.length);
    const spread = (pts: TrackPoint[]) =>
      Math.max(...pts.map((p) => p.lng)) - Math.min(...pts.map((p) => p.lng));
    expect(spread(sm.slice(3))).toBeLessThan(spread(noisy.slice(3)));

    const two = [...walk(3, 1.4, 5, 0), { ...walk(1, 1.4, 5, 1, 3)[0]!, lat: 42 }];
    expect(smoothPoints(two)[3]!.lat).toBeCloseTo(42, 6); // önceki bölümle karışmaz
  });
});

describe('tırmanış', () => {
  it('3 m altı rakım gürültüsü sayılmaz; gerçek yükselişler toplanır', () => {
    expect(ascentFromAltitudes([10, 11, 10, 11, 10])).toBe(0);
    expect(ascentFromAltitudes([10, 14, 18, 15, 19])).toBe(8 + 4); // 10→18 (+8), 18→15 iniş, 15→19 (+4)
    expect(ascentFromAltitudes([null, 5, null, 9])).toBe(4);
    expect(ascentFromAltitudes([])).toBe(0);
  });
});

describe('süre', () => {
  it('duraklatmalar hariç geçen süre', () => {
    expect(
      elapsedSeconds({ startedAt: T0, now: T0 + 600_000, pausedMs: 120_000, pauseStartedAt: null }),
    ).toBe(480);
    // şu an duraklatılmış: duraklatma anından sonrası sayılmaz
    expect(
      elapsedSeconds({
        startedAt: T0,
        now: T0 + 600_000,
        pausedMs: 0,
        pauseStartedAt: T0 + 300_000,
      }),
    ).toBe(300);
    expect(elapsedSeconds({ startedAt: T0, now: T0 - 5, pausedMs: 0, pauseStartedAt: null })).toBe(
      0,
    );
  });
});

describe('kmMarksCrossed', () => {
  it('geçilen tam km işaretleri', () => {
    expect(kmMarksCrossed(900, 1100)).toEqual([1]);
    expect(kmMarksCrossed(900, 2100)).toEqual([1, 2]);
    expect(kmMarksCrossed(1000, 1500)).toEqual([]);
    expect(kmMarksCrossed(0, 999)).toEqual([]);
    expect(kmMarksCrossed(0, 1000)).toEqual([1]);
  });
});

describe('planlı rota ilerlemesi', () => {
  // Kuzeye 1 km'lik düz rota, 11 nokta (100 m aralık)
  const route: LngLat[] = Array.from({ length: 11 }, (_, i) => [29, 41 + i * 100 * DEG_PER_M]);
  const cum = cumulativeLengths(route);

  it('kümülatif uzunluk ≈ 1000 m', () => {
    expect(cum[cum.length - 1]).toBeCloseTo(1000, -1);
  });
  it('rota üzerindeki noktada ilerleme ve ~0 m uzaklık', () => {
    const p: LngLat = [29, 41 + 450 * DEG_PER_M];
    const r = advanceAlongRoute(route, cum, p);
    expect(r.distanceToRouteM).toBeLessThan(2);
    expect(r.progressM).toBeGreaterThan(440);
    expect(r.progressM).toBeLessThan(460);
  });
  it('yandan 60 m sapma: uzaklık ≈ 60 m', () => {
    const p: LngLat = [29 + 60 * DEG_PER_M * 1.32, 41 + 300 * DEG_PER_M];
    const r = advanceAlongRoute(route, cum, p);
    expect(r.distanceToRouteM).toBeGreaterThan(55);
    expect(r.distanceToRouteM).toBeLessThan(65);
  });
  it('döngü rotada başlangıç ile bitiş aynı yerde: ileri yönlü arama başa atlamaz', () => {
    const loop: LngLat[] = [
      [29, 41],
      [29, 41.005],
      [29.005, 41.005],
      [29.005, 41],
      [29, 41],
    ];
    const c = cumulativeLengths(loop);
    // Yürüyüşün başında (segment 0) iken noktaya yakın: segment 0
    const early = advanceAlongRoute(loop, c, [29, 41.0001], 0);
    expect(early.segmentIndex).toBe(0);
    // Son segmentteyken başlangıca dönüş: ilerleme toplam uzunluğa yakın olmalı (başa atlamamalı)
    const late = advanceAlongRoute(loop, c, [29.0001, 41], 3);
    expect(late.progressM).toBeGreaterThan(c[c.length - 1]! - 30);
  });
});

describe('rotadan sapma', () => {
  it('40 m üstü ardışık 3 örnekte sapma; dönünce hemen kalkar', () => {
    let s = { consecutive: 0, off: false };
    s = updateOffRoute(s, 50);
    s = updateOffRoute(s, 55);
    expect(s.off).toBe(false);
    s = updateOffRoute(s, 60);
    expect(s.off).toBe(true);
    s = updateOffRoute(s, 10);
    expect(s).toEqual({ consecutive: 0, off: false });
    // Tek seferlik sıçrama sapma sayılmaz
    s = updateOffRoute(updateOffRoute(s, 80), 5);
    expect(s.off).toBe(false);
  });
});

describe('varış tahmini', () => {
  it('kalan mesafe × tempo', () => {
    expect(estimateArrival({ now: T0, remainingM: 2000, paceSecPerKm: 600 })).toBe(T0 + 1_200_000);
    expect(estimateArrival({ now: T0, remainingM: 0, paceSecPerKm: 600 })).toBeNull();
    expect(estimateArrival({ now: T0, remainingM: 2000, paceSecPerKm: null })).toBeNull();
  });
});

describe('biçimleme ve konuşma', () => {
  it('saat, tempo, mesafe', () => {
    expect(formatElapsed(1424)).toBe('00:23:44');
    expect(formatElapsed(3725)).toBe('01:02:05');
    expect(formatPaceClock(676)).toBe('11:16');
    expect(formatPaceClock(null)).toBe('--:--');
    expect(formatPaceClock(0)).toBe('--:--');
    expect(formatKmClock(2100)).toBe('2,10');
    expect(formatKmClock(850)).toBe('0,85');
  });
  it('sözlü süre ve mesafe (Türkçe)', () => {
    expect(spokenDuration(670)).toBe('11 dakika 10 saniye');
    expect(spokenDuration(660)).toBe('11 dakika');
    expect(spokenDuration(45)).toBe('45 saniye');
    expect(spokenDistance(3800)).toBe('3,8 kilometre');
    expect(spokenDistance(850)).toBe('850 metre');
    expect(spokenDistance(5000)).toBe('5 kilometre');
  });
  it('km duyurusu (örnek cümle)', () => {
    expect(buildKmAnnouncement({ km: 1, paceSecPerKm: 670, remainingM: 3800 })).toBe(
      '1 kilometre tamamlandı. Tempon 11 dakika 10 saniye. Kalan 3,8 kilometre.',
    );
    expect(buildKmAnnouncement({ km: 3, paceSecPerKm: null, remainingM: null })).toBe(
      '3 kilometre tamamlandı.',
    );
    expect(buildKmAnnouncement({ km: 5, paceSecPerKm: 600, remainingM: 0 })).toBe(
      '5 kilometre tamamlandı. Tempon 10 dakika.',
    );
  });
  it('aktiviteye göre hız sınırı', () => {
    expect(maxSpeedMs('walk')).toBeLessThan(maxSpeedMs('run'));
    expect(maxSpeedMs('run')).toBeLessThan(maxSpeedMs('bike'));
  });
  it('yardımcı: haversine ile uyumlu test verisi', () => {
    const [a, b] = walk(2, 10, 1);
    expect(haversineM([a!.lng, a!.lat], [b!.lng, b!.lat])).toBeCloseTo(10, 0);
  });
});

describe('rota gidiş yönü', () => {
  // Önce doğuya (~1 km), sonra kuzeye (~1 km) giden L biçimli rota.
  const route: LngLat[] = [
    [29.0, 41.0],
    [29.012, 41.0],
    [29.012, 41.009],
  ];
  const cum = cumulativeLengths(route);

  it('pointAlongRoute: başta, sonda ve ortada', () => {
    expect(pointAlongRoute(route, cum, 0)).toEqual(route[0]);
    expect(pointAlongRoute(route, cum, 99_999)).toEqual(route[2]);
    const mid = pointAlongRoute(route, cum, cum[1]! / 2);
    expect(mid[0]).toBeCloseTo(29.006, 4);
    expect(mid[1]).toBeCloseTo(41.0, 4);
  });

  it('ilk bacakta doğuya bakar', () => {
    expect(routeHeadingAt(route, cum, 200)!).toBeCloseTo(90, 0);
  });

  it('ikinci bacakta kuzeye bakar', () => {
    expect(routeHeadingAt(route, cum, cum[1]! + 200)!).toBeCloseTo(0, 0);
  });

  it('rotanın sonunda son bacağın yönünü korur', () => {
    expect(routeHeadingAt(route, cum, cum[2]!)!).toBeCloseTo(0, 0);
    expect(routeHeadingAt(route, cum, cum[2]! + 500)!).toBeCloseTo(0, 0);
  });

  it('tek noktalı rotada null', () => {
    expect(routeHeadingAt([[29, 41]], [0], 0)).toBeNull();
  });
});
