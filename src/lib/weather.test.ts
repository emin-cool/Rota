import {
  bestWindow,
  conditionFor,
  formatHourRange,
  formatTemp,
  hoursFrom,
  hourPenalty,
  localHour,
  qualityOf,
  warningsFor,
  workoutHint,
  type HourlyWeather,
} from './weather';

const BASE = 1_792_357_200; // yerel (UTC+3) gün başı gibi kullanılır
const OFFSET = 10800;

/** i. saat (BASE'den itibaren), varsayılan: rahat, kuru, gündüz. */
const hr = (i: number, over: Partial<HourlyWeather> = {}): HourlyWeather => ({
  t: BASE + i * 3600,
  tempC: 18,
  feelsC: 18,
  precipMm: 0,
  precipProb: 0,
  windKmh: 8,
  code: 1,
  isDay: true,
  uv: 2,
  ...over,
});

describe('conditionFor', () => {
  it('WMO kodlarını Türkçe etiket ve ikona çevirir', () => {
    expect(conditionFor(0, true)).toEqual({ label: 'Açık', icon: 'wb-sunny' });
    expect(conditionFor(0, false).icon).toBe('nights-stay');
    expect(conditionFor(2, true).label).toBe('Parçalı bulutlu');
    expect(conditionFor(3, true).label).toBe('Kapalı');
    expect(conditionFor(61, true)).toMatchObject({ label: 'Yağmurlu', icon: 'umbrella' });
    expect(conditionFor(65, true).label).toBe('Kuvvetli yağış');
    expect(conditionFor(71, true).label).toBe('Karlı');
    expect(conditionFor(95, true)).toMatchObject({ icon: 'thunderstorm' });
    expect(conditionFor(999, true).label).toBe('Kapalı'); // bilinmeyen kod güvenli varsayılan
  });
});

describe('zaman yardımcıları', () => {
  it('yerel saati UTC farkıyla hesaplar', () => {
    const midnight = BASE; // 21:00 UTC + 3 sa = 00:00 yerel
    expect(localHour(midnight, OFFSET)).toBe(0);
    expect(localHour(midnight + 18 * 3600, OFFSET)).toBe(18);
    expect(localHour(midnight + 24 * 3600, OFFSET)).toBe(0);
  });

  it('şu anı içeren saatten başlayan dilimi verir', () => {
    const hours = Array.from({ length: 10 }, (_, i) => hr(i));
    const slice = hoursFrom(hours, BASE + 3 * 3600 + 1200, 4);
    expect(slice.map((h) => h.t)).toEqual([3, 4, 5, 6].map((i) => BASE + i * 3600));
    expect(hoursFrom(hours, BASE + 99 * 3600, 4)).toEqual([]);
  });

  it('sıcaklık ve saat aralığı biçimi', () => {
    expect(formatTemp(16.6)).toBe('17°');
    expect(formatHourRange(BASE + 18 * 3600, BASE + 20 * 3600, OFFSET)).toBe('18:00–20:00');
  });
});

describe('warningsFor', () => {
  it('sakin havada uyarı yok', () => {
    expect(warningsFor([hr(0), hr(1)])).toEqual([]);
    expect(warningsFor([])).toEqual([]);
  });

  it('yağmur: kod, olasılık ya da toplam mm', () => {
    expect(warningsFor([hr(0, { code: 61 })]).map((w) => w.kind)).toEqual(['rain']);
    expect(warningsFor([hr(0, { precipProb: 60 })]).map((w) => w.kind)).toEqual(['rain']);
    expect(
      warningsFor([hr(0, { precipMm: 0.6 }), hr(1, { precipMm: 0.6 })]).map((w) => w.kind),
    ).toEqual(['rain']);
    expect(warningsFor([hr(0, { precipProb: 30 })])).toEqual([]);
  });

  it('fırtına ve kar en önce, sonra yağmur sıralanır', () => {
    const kinds = warningsFor([hr(0, { code: 95, precipProb: 90 }), hr(1, { code: 73 })]).map(
      (w) => w.kind,
    );
    expect(kinds).toEqual(['storm', 'snow', 'rain']);
  });

  it('sıcak ve soğuk hissedilen sıcaklığa göre; ikisi birden çıkmaz', () => {
    expect(warningsFor([hr(0, { feelsC: 33 })])[0]).toMatchObject({ kind: 'heat' });
    expect(warningsFor([hr(0, { feelsC: 33 })])[0]!.message).toContain('33°');
    expect(warningsFor([hr(0, { feelsC: -2 })])[0]).toMatchObject({ kind: 'cold' });
    expect(warningsFor([hr(0, { feelsC: 33 }), hr(1, { feelsC: -2 })]).map((w) => w.kind)).toEqual([
      'heat',
    ]);
  });

  it('rüzgâr ve UV (UV yalnızca gündüz)', () => {
    expect(warningsFor([hr(0, { windKmh: 45 })])[0]).toMatchObject({ kind: 'wind' });
    expect(warningsFor([hr(0, { uv: 9 })])[0]).toMatchObject({ kind: 'uv' });
    expect(warningsFor([hr(0, { uv: 9, isDay: false })])).toEqual([]);
  });
});

describe('hourPenalty / qualityOf', () => {
  it('rahat, kuru saat 0; yağış, uç sıcaklık, rüzgâr ve UV ceza ekler', () => {
    expect(hourPenalty(hr(0), 'walk')).toBe(0);
    expect(hourPenalty(hr(0, { precipProb: 80 }), 'walk')).toBeCloseTo(40);
    expect(hourPenalty(hr(0, { feelsC: 30 }), 'walk')).toBeCloseTo(24); // 6° dışında × 4
    expect(hourPenalty(hr(0, { windKmh: 30 }), 'bike')).toBeCloseTo(15); // 10 × 1,5
    expect(hourPenalty(hr(0, { uv: 8 }), 'walk')).toBeCloseTo(12);
    expect(hourPenalty(hr(0, { code: 95 }), 'walk')).toBeGreaterThanOrEqual(100);
  });

  it('koşu için aynı sıcaklık yürüyüşten daha uygunsuz', () => {
    const h = hr(0, { feelsC: 24 });
    expect(hourPenalty(h, 'run')).toBeGreaterThan(hourPenalty(h, 'walk'));
  });

  it('kalite eşikleri', () => {
    expect(qualityOf(0)).toBe('good');
    expect(qualityOf(14.9)).toBe('good');
    expect(qualityOf(15)).toBe('fair');
    expect(qualityOf(40)).toBe('poor');
  });
});

describe('bestWindow', () => {
  // BASE yerel 00:00; "şimdi" yerel 10:00
  const start = BASE + 10 * 3600;
  const day = (over: (i: number) => Partial<HourlyWeather> = () => ({})) =>
    Array.from({ length: 48 }, (_, i) => hr(i, { isDay: i % 24 >= 6 && i % 24 < 20, ...over(i) }));

  it('yağmurlu saatleri atlayıp kuru pencereyi seçer', () => {
    // 10:00–16:59 yağmurlu, 17:00 sonrası kuru
    const hours = day((i) => (i >= 10 && i < 17 ? { code: 61, precipProb: 90, precipMm: 1 } : {}));
    const w = bestWindow(hours, start, 'walk')!;
    expect(w.startT).toBe(BASE + 17 * 3600);
    expect(w.endT).toBe(BASE + 19 * 3600);
    expect(w.quality).toBe('good');
    expect(w.now).toBe(false);
  });

  it('şimdi uygunsa pencere şimdiyi içerir', () => {
    const w = bestWindow(day(), start, 'walk')!;
    expect(w.now).toBe(true);
    expect(w.startT).toBe(start);
  });

  it('gece saatleri önerilmez; yalnızca gece kalırsa null döner', () => {
    const night = Array.from({ length: 24 }, (_, i) => hr(i, { isDay: false }));
    expect(bestWindow(night, BASE, 'walk')).toBeNull();
    // yerel 20:00'de bakınca en uygun pencere ertesi sabah
    const w = bestWindow(day(), BASE + 20 * 3600, 'walk')!;
    expect(w.startT).toBeGreaterThanOrEqual(BASE + 30 * 3600);
  });

  it('aktiviteye göre farklı saat seçebilir (koşu için daha serin)', () => {
    // 17:00'ye kadar sıcak (24°), sonra serin (16°): koşu serin saati seçer, yürüyüş ilk uygun saati
    const hours = day((i) => ({ feelsC: i % 24 < 17 ? 24 : 16 }));
    const run = bestWindow(hours, start, 'run')!;
    expect(localHour(run.startT, OFFSET)).toBeGreaterThanOrEqual(17);
    const walk = bestWindow(hours, start, 'walk')!;
    expect(walk.startT).toBe(start);
  });

  it('kötü hava tüm gün sürerse yine en iyisini "poor" kalitesiyle verir', () => {
    const hours = day(() => ({ code: 61, precipProb: 100, precipMm: 3 }));
    expect(bestWindow(hours, start, 'walk')!.quality).toBe('poor');
  });
});

describe('workoutHint', () => {
  it('sakin havada olumlu, uyarı varsa uyarıyı söyler', () => {
    expect(workoutHint([hr(0)])).toContain('uygun');
    expect(workoutHint([hr(0, { code: 61 })])).toContain('Yağmur');
  });
});
