// Hava durumu Edge Function'ı. Akış: JWT doğrula → konumu ~5 km hücreye yuvarla → önbellek (30 dk) →
// sağlayıcı (Open-Meteo) → önbelleğe yaz. Sağlayıcıya ulaşılamazsa ≤ 6 saatlik eski tahmin döner.
// İstemci sağlayıcıyı bilmez; sağlayıcı bu fonksiyonda değiştirilir (lisans: docs/03 "Hava").
// Gizlilik: istemci zaten yuvarlanmış konum yollar; burada ayrıca yuvarlanır, ham konum saklanmaz.
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { AppError, errors } from '../_shared/errors.ts';
import {
  UPSTREAM_PER_HOUR_LIMIT,
  CACHE_TTL_MS,
  STALE_MAX_MS,
  cellOf,
  isFresh,
  normalizeOpenMeteo,
  openMeteoUrl,
  type WeatherData,
  type WeatherResponse,
} from '../_shared/weather.ts';
import type { ErrorBody } from '../_shared/types.ts';

const inputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const UPSTREAM_TIMEOUT_MS = 8000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: WeatherResponse | ErrorBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    console.error(`[weather] ${name} tanımlı değil`);
    throw errors.internal();
  }
  return value;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'POST') throw errors.invalidInput('yalnızca POST desteklenir');

    const supabaseUrl = requireEnv('SUPABASE_URL');
    const anonKey = requireEnv('SUPABASE_ANON_KEY');
    const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    // 1) Kullanıcıyı doğrula (verify_jwt kapalı; kontrol burada yapılıyor).
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) throw errors.unauthorized();
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) throw errors.unauthorized();

    // 2) Girdi.
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw errors.invalidInput('gövde JSON olmalı');
    }
    const parsed = inputSchema.safeParse(raw);
    if (!parsed.success) throw errors.invalidInput('lat ve lng sayı olmalı');
    const cell = cellOf(parsed.data.lat, parsed.data.lng);

    // 3) Önbellek.
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: hit } = await admin
      .from('weather_cache')
      .select('payload, fetched_at')
      .eq('cell_key', cell.key)
      .maybeSingle();
    const cachedAt = hit ? Date.parse(hit.fetched_at as string) : NaN;
    const cached = hit ? (hit.payload as WeatherData) : null;
    if (cached && isFresh(cachedAt, Date.now(), CACHE_TTL_MS)) {
      return json({ weather: cached, cached: true });
    }
    const staleOk = cached !== null && Date.now() - cachedAt < STALE_MAX_MS;

    // 4) Genel sigorta: saatte çok fazla farklı hücre çekildiyse sağlayıcıya gitme.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('weather_cache')
      .select('cell_key', { count: 'exact', head: true })
      .gte('fetched_at', since);
    if ((count ?? 0) >= UPSTREAM_PER_HOUR_LIMIT) {
      if (staleOk) return json({ weather: cached!, cached: true, stale: true });
      throw errors.weatherUnavailable();
    }

    // 5) Sağlayıcı.
    let weather: WeatherData;
    try {
      const res = await fetch(openMeteoUrl(cell), {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
      weather = normalizeOpenMeteo(await res.json(), Date.now());
    } catch (e) {
      console.error('[weather] sağlayıcı hatası:', e instanceof Error ? e.message : e);
      if (staleOk) return json({ weather: cached!, cached: true, stale: true });
      throw errors.weatherUnavailable();
    }

    // 6) Yaz; eski kayıtları (1 günden eski) temizle.
    await admin
      .from('weather_cache')
      .upsert(
        {
          cell_key: cell.key,
          provider: weather.provider,
          payload: weather,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'cell_key' },
      );
    await admin
      .from('weather_cache')
      .delete()
      .lt('fetched_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return json({ weather, cached: false });
  } catch (e) {
    const err = e instanceof AppError ? e : errors.internal();
    if (!(e instanceof AppError)) console.error('[weather]', e);
    return json({ error: { code: err.code, message: err.message } }, err.status);
  }
});
