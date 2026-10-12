// Rota üretim Edge Function'ı (docs/03-teknik-mimari.md "Rota üretim akışı").
// Akış: JWT doğrula → girdi doğrula → cache → günlük limit → ORS + Overpass → skorla → cache'le.
// Saf hesaplamalar ../_shared altında; burada yalnızca HTTP, Supabase ve ortam değişkenleri var.
import { createClient } from '@supabase/supabase-js';

import { inputHash } from '../_shared/cacheKey.ts';
import { AppError, errors } from '../_shared/errors.ts';
import { generate } from '../_shared/generate.ts';
import { fetchOrsCandidates } from '../_shared/ors.ts';
import { featureFromDb, type OsmDbFeature } from '../_shared/osm.ts';
import { inputSchema } from '../_shared/schema.ts';
import type { ErrorBody, GenerateRoutesResponse } from '../_shared/types.ts';

/** Kullanıcı başına 24 saatte en fazla bu kadar (önbellekten gelmeyen) üretim. */
const DAILY_LIMIT = 30;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: GenerateRoutesResponse | ErrorBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    console.error(`[generate-routes] ${name} tanımlı değil`);
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
    const orsKey = requireEnv('ORS_API_KEY');

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
    const userId = userData.user.id;

    // 2) Girdiyi doğrula.
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw errors.invalidInput('gövde JSON olmalı');
    }
    const parsed = inputSchema.safeParse(raw);
    if (!parsed.success) {
      throw errors.invalidInput(
        parsed.error.issues.map((i) => `${i.path.join('.') || 'girdi'}: ${i.message}`).join('; '),
      );
    }
    const input = parsed.data;

    // 3) Önbellek (route_cache yalnızca service role ile okunur/yazılır).
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const hash = await inputHash(input);
    const { data: hit } = await admin
      .from('route_cache')
      .select('result')
      .eq('input_hash', hash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (hit) {
      return json({ ...(hit.result as GenerateRoutesResponse), cached: true });
    }

    // 4) Günlük limit: yalnızca önbellekten gelmeyen (ORS harcayan) istekler sayılır.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('route_generation_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since);
    if ((count ?? 0) >= DAILY_LIMIT) throw errors.rateLimited(DAILY_LIMIT);
    await admin.from('route_generation_log').insert({ user_id: userId });

    // 5) Üret.
    const logs: string[] = [];
    const started = Date.now();
    const log = (message: string) => {
      logs.push(message);
      console.log(`[generate-routes] ${message}`);
    };
    const { routes, warnings } = await generate(input, {
      fetchCandidates: (requests) => fetchOrsCandidates(requests, orsKey, fetch, 4, 20_000, log),
      // Manzara verisi kendi veritabanımızda (scripts/osm-import.mjs ile yüklenir): canlı Overpass
      // Edge'den güvenilir çalışmadığı için kullanılmıyor.
      fetchFeatures: async (bbox) => {
        const began = Date.now();
        const { data, error } = await admin.rpc('osm_features_in_bbox', {
          p_west: bbox.west,
          p_south: bbox.south,
          p_east: bbox.east,
          p_north: bbox.north,
        });
        if (error) throw new Error(error.message);
        const features = ((data ?? []) as OsmDbFeature[]).map(featureFromDb);
        log(`OSM veritabanı: ${features.length} nesne, ${Date.now() - began} ms`);
        if (features.length === 0) throw new Error('OSM verisi yok (kapsam dışı olabilir)');
        return features;
      },
      log,
    });
    log(`toplam ${Date.now() - started} ms`);
    const result: GenerateRoutesResponse = {
      routes,
      cached: false,
      ...(warnings.length > 0 ? { warnings } : {}),
    };

    // 6) 24 saat önbelleğe al. Manzara verisi eksikse (nötr skor) önbelleğe alma.
    if (warnings.length === 0) {
      await admin.from('route_cache').upsert(
        {
          input_hash: hash,
          result,
          expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
        },
        { onConflict: 'input_hash' },
      );
    }
    return json(input.debug ? { ...result, debug: logs } : result);
  } catch (e) {
    const err = e instanceof AppError ? e : errors.internal();
    if (!(e instanceof AppError)) console.error('[generate-routes]', e);
    return json({ error: { code: err.code, message: err.message } }, err.status);
  }
});
