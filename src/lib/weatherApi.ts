import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { tr } from '@/i18n/tr';
import { supabase } from '@/lib/supabase';
import type { LngLat } from '@/lib/geo';
import {
  cellOf,
  type Cell,
  type WeatherResponse,
} from '../../supabase/functions/_shared/weather.ts';

export class WeatherError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'WeatherError';
  }
}

/**
 * Konumu ~5 km'lik hücreye yuvarlar. Sunucuya ham konum HİÇ gitmez (gizlilik);
 * yuvarlanmış hücre aynı zamanda sorgu anahtarıdır.
 */
export function weatherCell(coords: LngLat): Cell {
  return cellOf(coords[1], coords[0]);
}

/** Edge Function `weather`: yaklaşık konum için 3 günlük saatlik tahmin. */
export async function fetchWeather(cell: Pick<Cell, 'lat' | 'lng'>): Promise<WeatherResponse> {
  const { data, error } = await supabase.functions.invoke<WeatherResponse>('weather', {
    body: { lat: cell.lat, lng: cell.lng },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => null)) as {
        error?: { code: string; message: string };
      } | null;
      if (body?.error) throw new WeatherError(body.error.code, body.error.message);
    }
    if (error instanceof FunctionsFetchError)
      throw new WeatherError('network', tr.weather.errorLoad);
    throw new WeatherError('internal', tr.weather.errorLoad);
  }
  if (!data?.weather) throw new WeatherError('internal', tr.weather.errorLoad);
  return data;
}
