// Yeni `reports` satırı eklenince moderatöre e-posta atar (Apple 1.2: 24 saat içinde müdahale).
// Tetikleyici: Database Webhook (reports → INSERT) → bu fonksiyon. E-posta: Resend API.
// Gerekli secret'lar: REPORT_WEBHOOK_SECRET, RESEND_API_KEY, REPORT_NOTIFY_EMAIL (opsiyonel REPORT_FROM_EMAIL).
// E-postaya raporlayanın kimliği/e-postası konmaz; yalnızca rapor kimliği ve içerik türü gider.

interface ReportRecord {
  id?: string;
  target_type?: string;
  target_id?: string;
  reason?: string;
  details?: string | null;
  created_at?: string;
}

interface WebhookPayload {
  type?: string;
  table?: string;
  record?: ReportRecord;
}

const TARGET_LABELS: Record<string, string> = {
  activity: 'Aktivite',
  comment: 'Yorum',
  profile: 'Profil',
  review: 'Rota yorumu',
};

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Taciz',
  inappropriate: 'Uygunsuz içerik',
  dangerous: 'Tehlikeli',
  other: 'Diğer',
};

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

function buildEmail(r: ReportRecord): { subject: string; text: string } {
  const target = TARGET_LABELS[r.target_type ?? ''] ?? r.target_type ?? '?';
  const reason = REASON_LABELS[r.reason ?? ''] ?? r.reason ?? '?';
  const lines = [
    `Yeni bildirim: ${target} — ${reason}`,
    '',
    `Rapor: ${r.id ?? '?'}`,
    `Hedef (${r.target_type ?? '?'}): ${r.target_id ?? '?'}`,
    `Tarih: ${r.created_at ?? '?'}`,
    '',
    'Açıklama (kullanıcı yazdı, güvenilmeyen metin):',
    r.details?.trim() ? r.details.trim() : '(yok)',
    '',
    'İncele: Supabase → Table Editor → reports (status = open).',
    '24 saat içinde karar ver; status: reviewed / actioned / dismissed.',
  ];
  return { subject: `[Rota] Yeni bildirim: ${target} / ${reason}`, text: lines.join('\n') };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'invalid_input' }, 405);

  const secret = Deno.env.get('REPORT_WEBHOOK_SECRET');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('REPORT_NOTIFY_EMAIL');
  if (!secret || !resendKey || !to) {
    console.error('[notify-report] ortam değişkenleri eksik');
    return json({ error: 'internal' }, 500);
  }

  const provided = req.headers.get('x-webhook-secret') ?? '';
  if (!safeEqual(provided, secret)) return json({ error: 'unauthorized' }, 401);

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return json({ error: 'invalid_input' }, 400);
  }
  if (payload.type !== 'INSERT' || payload.table !== 'reports' || !payload.record) {
    return json({ ok: true, skipped: true });
  }

  const { subject, text } = buildEmail(payload.record);
  const from = Deno.env.get('REPORT_FROM_EMAIL') ?? 'Rota <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!res.ok) {
    console.error('[notify-report] e-posta gönderilemedi', res.status);
    return json({ error: 'email_failed' }, 502);
  }
  return json({ ok: true });
});
