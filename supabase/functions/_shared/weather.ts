// Hava durumu: hücre yuvarlama, Open-Meteo isteği ve yanıtın sadeleştirilmesi (saf fonksiyonlar).
// Sağlayıcı yalnızca bu dosyada ve `weather/index.ts`'te bilinir; istemci bizim biçimimizi görür.
// Böylece sağlayıcı (ücretli plan, MET Norway…) uygulama güncellemesi olmadan değiştirilebilir.

/** Konum bu kadar dereceye (≈ 5 km) yuvarlanır: hem önbellek anahtarı hem gizlilik. */
export const CELL_DEG = 0.05;
/** Önbellekteki tahmin bu kadar süre taze sayılır. */
export const CACHE_TTL_MS = 30 * 60 * 1000;
/** Sağlayıcı yanıt vermezse en çok bu kadar eski tahmin gösterilir. */
export const STALE_MAX_MS = 6 * 60 * 60 * 1000;
/** Saatte en çok bu kadar farklı hücre için sağlayıcıya gidilir (ücretsiz katman günlük 10.000). */
export const UPSTREAM_PER_HOUR_LIMIT = 300;

export type CurrentWeather = {
  /** Unix zamanı (sn). */
  t: number;
  tempC: number;
  feelsC: number;
  precipMm: number;
  windKmh: number;
  /** WMO hava kodu. */
  code: number;
  isDay: boolean;
};

export type HourlyWeather = {
  /** Saat başı, Unix zamanı (sn). */
  t: number;
  tempC: number;
  feelsC: number;
  precipMm: number;
  /** Yağış olasılığı (%); sağlayıcı vermezse 0. */
  precipProb: number;
  windKmh: number;
  code: number;
  isDay: boolean;
  uv: number;
};

export type WeatherData = {
  provider: 'open-meteo';
  /** Sağlayıcıdan alındığı an (Unix sn). */
  fetchedAt: number;
  /** Konumun UTC farkı (sn); saatleri yerel göstermek için. */
  utcOffsetSeconds: number;
  timezone: string;
  current: CurrentWeather;
  /** Bugün 00:00'dan başlayan 3 günlük saatlik tahmin (yerel gün başı). */
  hourly: HourlyWeather[];
};

export type WeatherResponse = {
  weather: WeatherData;
  /** Önbellekten geldi mi. */
  cached: boolean;
  /** Sağlayıcıya ulaşılamadığı için eski tahmin gösteriliyor. */
  stale?: boolean;
};

export type Cell = { lat: number; lng: number; key: string };

/** Konumu `CELL_DEG` ızgarasına oturtur; anahtar sabit biçimlidir ("41.05:29.00"). */
export function cellOf(lat: number, lng: number): Cell {
  const snap = (v: number) => Math.round(Math.round(v / CELL_DEG) * CELL_DEG * 100) / 100;
  const cl = snap(lat);
  const cg = snap(lng);
  return { lat: cl, lng: cg, key: `${cl.toFixed(2)}:${cg.toFixed(2)}` };
}

export function isFresh(fetchedAtMs: number, nowMs: number, ttlMs = CACHE_TTL_MS): boolean {
  return nowMs - fetchedAtMs < ttlMs;
}

export function openMeteoUrl(cell: Pick<Cell, 'lat' | 'lng'>): string {
  const q = new URLSearchParams({
    latitude: String(cell.lat),
    longitude: String(cell.lng),
    current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day',
    hourly:
      'temperature_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,wind_speed_10m,is_day,uv_index',
    forecast_days: '3',
    timezone: 'auto',
    timeformat: 'unixtime',
    wind_speed_unit: 'kmh',
  });
  return `https://api.open-meteo.com/v1/forecast?${q.toString()}`;
}

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

type Series = Record<string, unknown[] | undefined>;

/** Open-Meteo yanıtını bizim biçimimize çevirir; beklenen alanlar yoksa hata atar. */
export function normalizeOpenMeteo(json: unknown, fetchedAtMs: number): WeatherData {
  const d = json as {
    utc_offset_seconds?: unknown;
    timezone?: unknown;
    current?: Record<string, unknown>;
    hourly?: Series;
  } | null;
  if (!d || typeof d !== 'object' || !d.current || !d.hourly) {
    throw new Error('Open-Meteo yanıtı beklenen biçimde değil');
  }
  const c = d.current;
  if (typeof c.time !== 'number' || typeof c.temperature_2m !== 'number') {
    throw new Error('Open-Meteo anlık veri eksik');
  }
  const h = d.hourly;
  const times = h.time;
  if (!Array.isArray(times) || times.length === 0) throw new Error('Open-Meteo saatlik veri eksik');

  const at = (key: string, i: number) => h[key]?.[i];
  const hourly: HourlyWeather[] = [];
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    const temp = at('temperature_2m', i);
    if (typeof t !== 'number' || typeof temp !== 'number') continue; // eksik saati atla
    hourly.push({
      t,
      tempC: temp,
      feelsC: num(at('apparent_temperature', i), temp),
      precipMm: num(at('precipitation', i)),
      precipProb: num(at('precipitation_probability', i)),
      windKmh: num(at('wind_speed_10m', i)),
      code: num(at('weather_code', i)),
      isDay: at('is_day', i) === 1,
      uv: num(at('uv_index', i)),
    });
  }
  if (hourly.length === 0) throw new Error('Open-Meteo saatlik veri boş');

  return {
    provider: 'open-meteo',
    fetchedAt: Math.floor(fetchedAtMs / 1000),
    utcOffsetSeconds: num(d.utc_offset_seconds),
    timezone: typeof d.timezone === 'string' ? d.timezone : 'UTC',
    current: {
      t: c.time,
      tempC: c.temperature_2m,
      feelsC: num(c.apparent_temperature, c.temperature_2m),
      precipMm: num(c.precipitation),
      windKmh: num(c.wind_speed_10m),
      code: num(c.weather_code),
      isDay: c.is_day === 1,
    },
    hourly,
  };
}
