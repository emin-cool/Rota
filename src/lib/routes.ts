import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { tr } from '@/i18n/tr';
import { supabase } from '@/lib/supabase';
import { difficultyOf } from '@/lib/wizard';
import type {
  ErrorBody,
  ErrorCode,
  GenerateRoutesInput,
  GenerateRoutesResponse,
  RouteOption,
} from '@/types/routes';

/** Sunucunun Türkçe, kullanıcıya gösterilebilir mesajını taşıyan hata. */
export class GenerateRoutesError extends Error {
  readonly code: ErrorCode | 'network';

  constructor(code: ErrorCode | 'network', message: string) {
    super(message);
    this.name = 'GenerateRoutesError';
    this.code = code;
  }
}

/**
 * Sihirbaz cevaplarından 3 rota üretir (Edge Function: generate-routes).
 * ORS/Overpass anahtarları sunucuda; istemci yalnızca oturum jetonuyla çağırır.
 */
export async function generateRoutes(input: GenerateRoutesInput): Promise<GenerateRoutesResponse> {
  const { data, error } = await supabase.functions.invoke<GenerateRoutesResponse>(
    'generate-routes',
    { body: input },
  );

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => null)) as ErrorBody | null;
      if (body?.error) throw new GenerateRoutesError(body.error.code, body.error.message);
    }
    if (error instanceof FunctionsFetchError) {
      throw new GenerateRoutesError('network', tr.routes.errors.network);
    }
    throw new GenerateRoutesError('internal', tr.routes.errors.generic);
  }
  if (!data) throw new GenerateRoutesError('internal', tr.routes.errors.generic);
  return data;
}

/** LineString/Point'i PostgREST'in kabul ettiği EWKT metnine çevirir. */
const toLineEwkt = (coords: [number, number][]) =>
  `SRID=4326;LINESTRING(${coords.map((c) => `${c[0]} ${c[1]}`).join(',')})`;

/**
 * Üretilen rotayı `routes` tablosuna (özel, is_public=false) ekler; kayıtlılara eklemez.
 * Kayıtlıya almadan aktivite başlatılırken (yorum/fotoğraf için route_id gerekir) bu kullanılır.
 */
export async function insertGeneratedRoute(params: {
  userId: string;
  route: RouteOption;
  input: GenerateRoutesInput;
  title: string;
}): Promise<string> {
  const { userId, route, input, title } = params;
  const coords = route.geojson.coordinates;
  const start = coords[0]!;

  const { data, error } = await supabase
    .from('routes')
    .insert({
      creator_id: userId,
      title,
      activity_type: input.activityType,
      route_type: input.routeType,
      geom: toLineEwkt(coords),
      start_point: `SRID=4326;POINT(${start[0]} ${start[1]})`,
      distance_m: route.distanceM,
      elevation_gain_m: route.elevationGainM,
      est_duration_min: route.estDurationMin,
      scenic_score: route.scenicScore,
      difficulty: difficultyOf(route.distanceM, route.elevationGainM),
      is_public: false,
    })
    .select('id')
    .single();
  if (error) throw error;

  return data.id as string;
}

/**
 * Üretilen rotayı `routes` tablosuna ve kullanıcının kayıtlılarına ekler.
 * Dönen değer routes.id; kaydı geri almak için `unsaveRoute` kullanılır.
 */
export async function saveGeneratedRoute(params: {
  userId: string;
  route: RouteOption;
  input: GenerateRoutesInput;
  title: string;
  /** Rota zaten `routes`'ta varsa (aktivite için eklenmişse) tekrar eklenmez. */
  existingRouteId?: string;
}): Promise<string> {
  const { userId, existingRouteId } = params;
  const routeId = existingRouteId ?? (await insertGeneratedRoute(params));
  const { error: saveError } = await supabase
    .from('saved_routes')
    .insert({ user_id: userId, route_id: routeId });
  if (saveError) throw saveError;
  return routeId;
}

/** Kayıtlılardan çıkarır (routes satırı kalır; tekrar kaydedilebilir). */
export async function unsaveRoute(userId: string, routeId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_routes')
    .delete()
    .eq('user_id', userId)
    .eq('route_id', routeId);
  if (error) throw error;
}
