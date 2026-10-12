import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { tr } from '@/i18n/tr';
import { supabase } from '@/lib/supabase';
import type {
  ErrorBody,
  ErrorCode,
  GenerateRoutesInput,
  GenerateRoutesResponse,
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
