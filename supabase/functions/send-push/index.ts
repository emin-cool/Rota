// Yeni `notifications` satırı için alıcının telefonuna push gönderir (Expo Push Service).
// Tetikleyici: Database Webhook (notifications → INSERT) → bu fonksiyon. Kurulum: docs/07-test-ve-yayin.md §6.
// Gerekli secret'lar: PUSH_WEBHOOK_SECRET. İsteğe bağlı: EXPO_ACCESS_TOKEN (Expo'da "gelişmiş güvenlik" açıksa).
// SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından otomatik verilir.
//
// Akış: gizli anahtarı doğrula → alıcının tercihine bak → hız sınırı → token'ları bul → Expo'ya gönder →
// geçersiz token'ları sil → gönderildiyse `pushed_at` işaretle. Metin: _shared/pushMessages.ts (içerik metni konmaz).
import { createClient } from '@supabase/supabase-js';

import {
  BURST_MAX,
  BURST_WINDOW_MS,
  buildPushMessage,
  displayActorName,
  isDeadTokenError,
  type NotificationType,
  settingForType,
  shouldThrottle,
  THROTTLE_MS,
} from '../_shared/pushMessages.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface NotificationRecord {
  id?: string;
  recipient_id?: string;
  actor_id?: string;
  type?: string;
  activity_id?: string | null;
}

interface WebhookPayload {
  type?: string;
  table?: string;
  record?: NotificationRecord;
}

interface ExpoTicket {
  status?: string;
  details?: { error?: string };
}

const TYPES: NotificationType[] = ['follow', 'follow_request', 'follow_accepted', 'kudos', 'comment'];

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Zamanlama saldırısına karşı sabit sürede karşılaştırma.
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) {
    diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  }
  return diff === 0;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'invalid_input' }, 405);

  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !supabaseUrl || !serviceKey) {
    console.error('[send-push] ortam değişkenleri eksik');
    return json({ error: 'internal' }, 500);
  }
  if (!safeEqual(req.headers.get('x-webhook-secret') ?? '', secret)) {
    return json({ error: 'unauthorized' }, 401);
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return json({ error: 'invalid_input' }, 400);
  }
  const rec = payload.record;
  if (payload.type !== 'INSERT' || payload.table !== 'notifications' || !rec) {
    return json({ ok: true, skipped: 'not_insert' });
  }
  const type = rec.type as NotificationType;
  if (!rec.id || !rec.recipient_id || !rec.actor_id || !TYPES.includes(type)) {
    return json({ error: 'invalid_input' }, 400);
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    // 1) Alıcının tercihi (satır yoksa hepsi açık).
    const { data: settings } = await db
      .from('notification_settings')
      .select('follows, kudos, comments')
      .eq('user_id', rec.recipient_id)
      .maybeSingle();
    if (settings && settings[settingForType(type)] === false) {
      return json({ ok: true, skipped: 'disabled' });
    }

    // 2) Token'lar.
    const { data: tokens } = await db
      .from('push_tokens')
      .select('token')
      .eq('user_id', rec.recipient_id);
    if (!tokens || tokens.length === 0) return json({ ok: true, skipped: 'no_token' });

    // 3) Hız sınırı: benzer push yakında gittiyse ya da kısa sürede çok push gittiyse gönderme.
    const now = Date.now();
    let similar = db
      .from('notifications')
      .select('pushed_at')
      .eq('recipient_id', rec.recipient_id)
      .eq('type', type)
      .neq('id', rec.id)
      .not('pushed_at', 'is', null)
      .gte('pushed_at', new Date(now - THROTTLE_MS).toISOString());
    similar = rec.activity_id ? similar.eq('activity_id', rec.activity_id) : similar.is('activity_id', null);
    const { data: similarRows } = await similar.order('pushed_at', { ascending: false }).limit(1);
    const lastSimilar = similarRows?.[0]?.pushed_at ? Date.parse(similarRows[0].pushed_at) : null;

    const { count: recentCount } = await db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', rec.recipient_id)
      .not('pushed_at', 'is', null)
      .gte('pushed_at', new Date(now - BURST_WINDOW_MS).toISOString());

    if (
      shouldThrottle({ lastSimilarPushedAt: lastSimilar, recentPushCount: recentCount ?? 0, now })
    ) {
      return json({ ok: true, skipped: 'throttled', burstMax: BURST_MAX });
    }

    // 4) Metin.
    const { data: actor } = await db
      .from('profiles')
      .select('display_name, username')
      .eq('user_id', rec.actor_id)
      .maybeSingle();
    const message = buildPushMessage({
      type,
      actorName: displayActorName(actor),
      actorId: rec.actor_id,
      activityId: rec.activity_id ?? null,
    });
    if (!message) return json({ ok: true, skipped: 'no_message' });

    // 5) Expo'ya gönder.
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    if (expoToken) headers.Authorization = `Bearer ${expoToken}`;

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(tokens.map((t) => ({ to: t.token, ...message }))),
    });
    if (!res.ok) {
      console.error('[send-push] Expo yanıtı', res.status);
      return json({ error: 'push_failed' }, 502);
    }
    const body = (await res.json()) as { data?: ExpoTicket[] };
    const tickets = body.data ?? [];

    // 6) Geçersiz token'ları sil, gönderildiyse işaretle.
    const dead = tokens
      .map((t, i) => (tickets[i] && isDeadTokenError(tickets[i]!) ? t.token : null))
      .filter((t): t is string => t !== null);
    if (dead.length > 0) await db.from('push_tokens').delete().in('token', dead);

    const sent = tickets.filter((t) => t.status === 'ok').length;
    if (sent > 0) {
      await db.from('notifications').update({ pushed_at: new Date().toISOString() }).eq('id', rec.id);
    }
    return json({ ok: true, sent, removedTokens: dead.length });
  } catch (e) {
    console.error('[send-push]', e instanceof Error ? e.message : e);
    return json({ error: 'internal' }, 500);
  }
});
