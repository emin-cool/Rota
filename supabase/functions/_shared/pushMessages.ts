// Push bildirimi metinleri ve hedef ekran verisi (saf fonksiyonlar; Deno ve Jest'te çalışır).
// Gizlilik: kilit ekranında görünür, bu yüzden yorum metni gibi içerik konmaz; yalnızca kimin ne yaptığı yazılır.

export type NotificationType = 'follow' | 'follow_request' | 'follow_accepted' | 'kudos' | 'comment';

export type SettingKey = 'follows' | 'kudos' | 'comments';

/** Bildirim türünü kullanıcının hangi tercih anahtarı yönetir. */
export function settingForType(type: NotificationType): SettingKey {
  switch (type) {
    case 'kudos':
      return 'kudos';
    case 'comment':
      return 'comments';
    default:
      return 'follows';
  }
}

/** İstemcinin bildirime dokununca nereye gideceğini bildiren veri (uygulama doğrular). */
export type PushData =
  | { screen: 'user'; userId: string }
  | { screen: 'follow-requests' }
  | { screen: 'activity'; activityId: string };

export type PushMessage = {
  title: string;
  body: string;
  data: PushData & { type: NotificationType };
  sound: 'default';
  channelId: 'default';
};

const MAX_NAME = 40;

/** Görünen ad ya da kullanıcı adı; boşsa nötr bir ifade. Bildirimde uzun/çok satırlı ad olmasın. */
export function displayActorName(
  profile: { display_name?: string | null; username?: string | null } | null | undefined,
): string {
  const raw = (profile?.display_name?.trim() || profile?.username?.trim() || '').replace(
    /\s+/g,
    ' ',
  );
  if (!raw) return 'Biri';
  return raw.length > MAX_NAME ? `${raw.slice(0, MAX_NAME - 1)}…` : raw;
}

export function buildPushMessage(params: {
  type: NotificationType;
  actorName: string;
  actorId: string;
  activityId: string | null;
}): PushMessage | null {
  const { type, actorName, actorId, activityId } = params;
  const base = { title: 'Rota', sound: 'default', channelId: 'default' } as const;
  switch (type) {
    case 'follow':
      return {
        ...base,
        body: `${actorName} seni takip etmeye başladı`,
        data: { type, screen: 'user', userId: actorId },
      };
    case 'follow_request':
      return {
        ...base,
        body: `${actorName} seni takip etmek istiyor`,
        data: { type, screen: 'follow-requests' },
      };
    case 'follow_accepted':
      return {
        ...base,
        body: `${actorName} takip isteğini kabul etti`,
        data: { type, screen: 'user', userId: actorId },
      };
    case 'kudos':
      if (!activityId) return null;
      return {
        ...base,
        body: `${actorName} aktiviteni alkışladı`,
        data: { type, screen: 'activity', activityId },
      };
    case 'comment':
      if (!activityId) return null;
      return {
        ...base,
        body: `${actorName} aktivitene yorum yaptı`,
        data: { type, screen: 'activity', activityId },
      };
    default:
      return null;
  }
}

/** Alkış/yorum seli olmasın: aynı alıcıya aynı tür ve aynı aktivite için bu süre içinde tek push. */
export const THROTTLE_MS = 10 * 60 * 1000;
/** Kullanıcı başına kısa sürede toplam push sınırı (kötüye kullanıma karşı). */
export const BURST_WINDOW_MS = 10 * 60 * 1000;
export const BURST_MAX = 10;

export function shouldThrottle(params: {
  /** Aynı alıcı + tür + aktivite için son push zamanı (ms), yoksa null. */
  lastSimilarPushedAt: number | null;
  /** Alıcıya BURST_WINDOW_MS içinde giden push sayısı. */
  recentPushCount: number;
  now: number;
}): boolean {
  const { lastSimilarPushedAt, recentPushCount, now } = params;
  if (lastSimilarPushedAt !== null && now - lastSimilarPushedAt < THROTTLE_MS) return true;
  return recentPushCount >= BURST_MAX;
}

/** Expo yanıtındaki hata, token'ın artık geçersiz olduğunu gösteriyor mu? */
export function isDeadTokenError(ticket: {
  status?: string;
  details?: { error?: string };
}): boolean {
  return ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered';
}
