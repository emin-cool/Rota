// Hesabı kalıcı siler (App Store zorunluluğu). Geri alınamaz.
// Akış: JWT doğrula → Storage dosyalarını sil → özel rotaları sil → auth kullanıcısını sil.
// Diğer tablolar (profiles, activities, route_reviews, route_photos, saved_routes) auth.users'a
// `on delete cascade` ile bağlı; kullanıcı silinince satırları da gider. Herkese açık rotalar
// (creator_id `on delete set null`) isimsiz olarak kalır.
import { createClient } from '@supabase/supabase-js';

const BUCKETS = ['route-photos', 'avatars'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'invalid_input' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('[delete-account] ortam değişkenleri eksik');
    return json({ error: 'internal' }, 500);
  }

  // verify_jwt kapalı; kullanıcıyı burada doğruluyoruz.
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    // 1) Storage: {userId}/ altındaki tüm dosyalar (sayfa sayfa).
    for (const bucket of BUCKETS) {
      for (;;) {
        const { data: files, error } = await admin.storage.from(bucket).list(userId, { limit: 100 });
        if (error) throw error;
        if (!files || files.length === 0) break;
        const { error: rmError } = await admin.storage
          .from(bucket)
          .remove(files.map((f) => `${userId}/${f.name}`));
        if (rmError) throw rmError;
        if (files.length < 100) break;
      }
    }

    // 2) Özel (üretilmiş) rotalar kullanıcıyla birlikte gider; herkese açıklar isimsiz kalır.
    const { error: routesError } = await admin
      .from('routes')
      .delete()
      .eq('creator_id', userId)
      .eq('is_public', false);
    if (routesError) throw routesError;

    // 3) Kullanıcının kendisi (cascade ile profil, aktivite, yorum, fotoğraf satırları gider).
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return json({ ok: true });
  } catch (e) {
    console.error('[delete-account]', e instanceof Error ? e.message : e);
    return json({ error: 'internal' }, 500);
  }
});
