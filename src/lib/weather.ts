// Hava durumu mantığı (saf): hava kodu → metin/ikon, uyarılar, "en uygun saat" önerisi.
import type { MaterialIcons } from '@expo/vector-icons';

import { tr } from '@/i18n/tr';
import type {
  CurrentWeather,
  HourlyWeather,
  WeatherData,
} from '../../supabase/functions/_shared/weather.ts';
import type { ActivityType } from '@/types/routes';

export type { CurrentWeather, HourlyWeather, WeatherData };
export type WeatherIcon = keyof typeof MaterialIcons.glyphMap;

// ---------------------------------------------------------------- hava kodu (WMO)

export type Condition = { label: string; icon: WeatherIcon };

export function conditionFor(code: number, isDay: boolean): Condition {
  const c = tr.weather.condition;
  if (code === 0)
    return isDay
      ? { label: c.clear, icon: 'wb-sunny' }
      : { label: c.clearNight, icon: 'nights-stay' };
  if (code === 1) return { label: c.mainlyClear, icon: isDay ? 'wb-sunny' : 'nights-stay' };
  if (code === 2) return { label: c.partlyCloudy, icon: 'wb-cloudy' };
  if (code === 3) return { label: c.overcast, icon: 'cloud' };
  if (code === 45 || code === 48) return { label: c.fog, icon: 'foggy' };
  if (code >= 51 && code <= 55) return { label: c.drizzle, icon: 'water-drop' };
  if (code === 56 || code === 57 || code === 66 || code === 67)
    return { label: c.freezingRain, icon: 'ac-unit' };
  if (code === 65 || code === 82) return { label: c.heavyRain, icon: 'umbrella' };
  if ((code >= 61 && code <= 63) || code === 80 || code === 81)
    return { label: c.rain, icon: 'umbrella' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { label: c.snow, icon: 'ac-unit' };
  if (code >= 95 && code <= 99) return { label: c.thunderstorm, icon: 'thunderstorm' };
  return { label: c.overcast, icon: 'cloud' };
}

const isRainCode = (code: number) =>
  (code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82);
const isSnowCode = (code: number) => (code >= 71 && code <= 77) || code === 85 || code === 86;
const isStormCode = (code: number) => code >= 95 && code <= 99;

// ---------------------------------------------------------------- zaman yardımcıları

export const HOUR_SEC = 3600;

/** Konumun yerel saati (0–23). */
export function localHour(t: number, utcOffsetSeconds: number): number {
  return Math.floor(((((t + utcOffsetSeconds) % 86400) + 86400) % 86400) / HOUR_SEC);
}

/** Şu anı (Unix sn) içeren saatten başlayarak en çok `count` saatlik dilim. */
export function hoursFrom(
  hourly: readonly HourlyWeather[],
  nowSec: number,
  count: number,
): HourlyWeather[] {
  const start = hourly.findIndex((h) => nowSec < h.t + HOUR_SEC);
  if (start < 0) return [];
  return hourly.slice(start, start + count);
}

export const formatTemp = (c: number): string => `${Math.round(c)}°`;

export function formatHourRange(startT: number, endT: number, utcOffsetSeconds: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(localHour(startT, utcOffsetSeconds))}:00–${pad(localHour(endT, utcOffsetSeconds))}:00`;
}

// ---------------------------------------------------------------- uyarılar

export type WarningKind = 'storm' | 'snow' | 'rain' | 'heat' | 'cold' | 'wind' | 'uv';

export type WeatherWarning = { kind: WarningKind; message: string };

/** Uyarı eşikleri (yaklaşık, ürün kararı; bilimsel eşik değil). */
export const THRESHOLDS = {
  rainProb: 50,
  rainMm: 1,
  heatFeelsC: 30,
  coldFeelsC: 0,
  windKmh: 40,
  uv: 8,
} as const;

/** Verilen saatler (tipik olarak önümüzdeki ~6 saat) için uyarılar, önem sırasıyla. */
export function warningsFor(hours: readonly HourlyWeather[]): WeatherWarning[] {
  if (hours.length === 0) return [];
  const w = tr.weather.warning;
  const out: WeatherWarning[] = [];
  const daylight = hours.filter((h) => h.isDay);

  if (hours.some((h) => isStormCode(h.code))) out.push({ kind: 'storm', message: w.storm });
  if (hours.some((h) => isSnowCode(h.code))) out.push({ kind: 'snow', message: w.snow });
  const rainMm = hours.reduce((sum, h) => sum + h.precipMm, 0);
  if (
    hours.some((h) => isRainCode(h.code) || h.precipProb >= THRESHOLDS.rainProb) ||
    rainMm >= THRESHOLDS.rainMm
  ) {
    out.push({ kind: 'rain', message: w.rain });
  }
  const maxFeels = Math.max(...hours.map((h) => h.feelsC));
  const minFeels = Math.min(...hours.map((h) => h.feelsC));
  if (maxFeels >= THRESHOLDS.heatFeelsC) {
    out.push({ kind: 'heat', message: w.heat(formatTemp(maxFeels)) });
  } else if (minFeels <= THRESHOLDS.coldFeelsC) {
    out.push({ kind: 'cold', message: w.cold(formatTemp(minFeels)) });
  }
  const maxWind = Math.max(...hours.map((h) => h.windKmh));
  if (maxWind >= THRESHOLDS.windKmh)
    out.push({ kind: 'wind', message: w.wind(Math.round(maxWind)) });
  if (daylight.some((h) => h.uv >= THRESHOLDS.uv)) out.push({ kind: 'uv', message: w.uv });
  return out;
}

// ---------------------------------------------------------------- en uygun saat

/** Aktiviteye göre rahat hissedilen sıcaklık aralığı (°C, hissedilen). */
export const COMFORT_RANGE: Record<ActivityType, { min: number; max: number }> = {
  walk: { min: 10, max: 24 },
  run: { min: 5, max: 18 },
  bike: { min: 10, max: 26 },
};

/** Bir saatin "uygunsuzluk" puanı (düşük = iyi). Basit bir sezgidir, bilimsel bir model değil. */
export function hourPenalty(h: HourlyWeather, activity: ActivityType): number {
  let p = 0;
  p += h.precipProb * 0.5 + h.precipMm * 20;
  if (isStormCode(h.code)) p += 100;
  if (isSnowCode(h.code)) p += 40;
  const range = COMFORT_RANGE[activity];
  if (h.feelsC < range.min) p += (range.min - h.feelsC) * 4;
  if (h.feelsC > range.max) p += (h.feelsC - range.max) * 4;
  const windLimit = 20;
  if (h.windKmh > windLimit) p += (h.windKmh - windLimit) * (activity === 'bike' ? 1.5 : 1);
  if (h.uv >= 6) p += (h.uv - 5) * 4;
  return p;
}

export type BestWindow = {
  startT: number;
  endT: number;
  /** Saat başına ortalama ceza (düşük = iyi). */
  penalty: number;
  quality: 'good' | 'fair' | 'poor';
  /** Pencere şu anki saati içeriyor mu. */
  now: boolean;
};

export const GOOD_PENALTY = 15;
export const FAIR_PENALTY = 40;
/** Öneri penceresi uzunluğu (saat). */
export const WINDOW_HOURS = 2;

export function qualityOf(penalty: number): BestWindow['quality'] {
  if (penalty < GOOD_PENALTY) return 'good';
  if (penalty < FAIR_PENALTY) return 'fair';
  return 'poor';
}

/**
 * Önümüzdeki `horizonHours` saatte, yalnızca gündüz saatlerinden oluşan en uygun `WINDOW_HOURS`
 * saatlik pencere. Eşitlikte erken olan seçilir. Uygun pencere yoksa null.
 */
export function bestWindow(
  hourly: readonly HourlyWeather[],
  nowSec: number,
  activity: ActivityType,
  horizonHours = 24,
): BestWindow | null {
  const hours = hoursFrom(hourly, nowSec, horizonHours);
  let best: BestWindow | null = null;
  for (let i = 0; i + WINDOW_HOURS <= hours.length; i++) {
    const slice = hours.slice(i, i + WINDOW_HOURS);
    const contiguous = slice.every((h, k) => k === 0 || h.t - slice[k - 1]!.t === HOUR_SEC);
    if (!contiguous || !slice.every((h) => h.isDay)) continue;
    const penalty = slice.reduce((sum, h) => sum + hourPenalty(h, activity), 0) / slice.length;
    if (best === null || penalty < best.penalty) {
      best = {
        startT: slice[0]!.t,
        endT: slice[slice.length - 1]!.t + HOUR_SEC,
        penalty,
        quality: qualityOf(penalty),
        now: i === 0,
      };
    }
  }
  return best;
}

/** Antrenman günü ekranı için tek satırlık ipucu (bugünün havası, önümüzdeki saatler). */
export function workoutHint(hours: readonly HourlyWeather[]): string {
  const warning = warningsFor(hours)[0];
  return warning ? tr.weather.workout.withWarning(warning.message) : tr.weather.workout.fine;
}
