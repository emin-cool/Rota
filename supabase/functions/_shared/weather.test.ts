import {
  CELL_DEG,
  CACHE_TTL_MS,
  cellOf,
  isFresh,
  normalizeOpenMeteo,
  openMeteoUrl,
} from './weather.ts';

// Gerçek Open-Meteo yanıtının biçimi (timeformat=unixtime, timezone=auto), kısaltılmış.
const sample = () => ({
  utc_offset_seconds: 10800,
  timezone: 'Europe/Istanbul',
  current: {
    time: 1792424700,
    interval: 900,
    temperature_2m: 16.7,
    apparent_temperature: 16.4,
    precipitation: 0.0,
    weather_code: 61,
    wind_speed_10m: 5.9,
    is_day: 0,
  },
  hourly: {
    time: [1792357200, 1792360800, 1792364400],
    temperature_2m: [13.6, 13.7, 13.9],
    apparent_temperature: [13.1, 13.2, null],
    precipitation: [0.0, 0.4, 0.0],
    precipitation_probability: [0, 55, null],
    weather_code: [2, 61, 3],
    wind_speed_10m: [7.0, 6.6, 7.4],
    is_day: [0, 1, 1],
    uv_index: [0.0, 1.5, 3.2],
  },
});

describe('cellOf', () => {
  it('konumu 0,05° ızgarasına oturtur ve sabit anahtar üretir', () => {
    expect(cellOf(41.0432, 28.9571)).toEqual({ lat: 41.05, lng: 28.95, key: '41.05:28.95' });
    expect(cellOf(41.0499, 29.0)).toMatchObject({ lat: 41.05, lng: 29, key: '41.05:29.00' });
    expect(CELL_DEG).toBe(0.05);
  });

  it('aynı hücredeki farklı konumlar aynı anahtarı verir', () => {
    expect(cellOf(41.031, 29.01).key).toBe(cellOf(41.069, 29.02).key);
    expect(cellOf(41.031, 29.01).key).not.toBe(cellOf(41.08, 29.01).key);
  });

  it('negatif koordinatlarda da çalışır', () => {
    expect(cellOf(-33.8688, 151.2093).key).toBe('-33.85:151.20');
  });
});

describe('isFresh', () => {
  it('TTL içinde taze, sonra bayat', () => {
    const now = 1_000_000_000;
    expect(isFresh(now - CACHE_TTL_MS + 1, now)).toBe(true);
    expect(isFresh(now - CACHE_TTL_MS, now)).toBe(false);
  });
});

describe('openMeteoUrl', () => {
  it('gerekli değişkenleri ve birimleri ister', () => {
    const url = new URL(openMeteoUrl({ lat: 41.05, lng: 29 }));
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('latitude')).toBe('41.05');
    expect(url.searchParams.get('longitude')).toBe('29');
    expect(url.searchParams.get('timeformat')).toBe('unixtime');
    expect(url.searchParams.get('timezone')).toBe('auto');
    expect(url.searchParams.get('hourly')).toContain('uv_index');
    expect(url.searchParams.get('hourly')).toContain('precipitation_probability');
    expect(url.searchParams.get('current')).toContain('weather_code');
  });
});

describe('normalizeOpenMeteo', () => {
  it('anlık ve saatlik veriyi sadeleştirir', () => {
    const w = normalizeOpenMeteo(sample(), 1792424800_000);
    expect(w).toMatchObject({
      provider: 'open-meteo',
      fetchedAt: 1792424800,
      utcOffsetSeconds: 10800,
      timezone: 'Europe/Istanbul',
    });
    expect(w.current).toEqual({
      t: 1792424700,
      tempC: 16.7,
      feelsC: 16.4,
      precipMm: 0,
      windKmh: 5.9,
      code: 61,
      isDay: false,
    });
    expect(w.hourly).toHaveLength(3);
    expect(w.hourly[1]).toEqual({
      t: 1792360800,
      tempC: 13.7,
      feelsC: 13.2,
      precipMm: 0.4,
      precipProb: 55,
      windKmh: 6.6,
      code: 61,
      isDay: true,
      uv: 1.5,
    });
  });

  it('boş (null) alanlarda makul varsayılan kullanır', () => {
    const w = normalizeOpenMeteo(sample(), 0);
    // hissedilen yoksa sıcaklık, olasılık yoksa 0
    expect(w.hourly[2]!.feelsC).toBe(13.9);
    expect(w.hourly[2]!.precipProb).toBe(0);
  });

  it('sıcaklığı olmayan saati atlar', () => {
    const s = sample();
    s.hourly.temperature_2m = [13.6, null as unknown as number, 13.9];
    const w = normalizeOpenMeteo(s, 0);
    expect(w.hourly.map((h) => h.t)).toEqual([1792357200, 1792364400]);
  });

  it('beklenmeyen yanıtta hata atar', () => {
    expect(() => normalizeOpenMeteo(null, 0)).toThrow();
    expect(() => normalizeOpenMeteo({}, 0)).toThrow();
    expect(() => normalizeOpenMeteo({ ...sample(), hourly: { time: [] } }, 0)).toThrow();
    expect(() => normalizeOpenMeteo({ ...sample(), current: { time: 1 } }, 0)).toThrow();
  });
});
