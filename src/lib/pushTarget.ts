// Bildirime dokununca açılacak ekranı, sunucudan gelen `data`'dan güvenle çözer (saf fonksiyon).
// `data` ağdan geldiği için güvenilmez kabul edilir: yalnızca bilinen ekranlar ve UUID biçimli kimlikler geçer.

export type PushTarget =
  | { screen: 'user'; userId: string }
  | { screen: 'follow-requests' }
  | { screen: 'activity'; activityId: string }
  | { screen: 'course-day'; courseDayId: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

export function parsePushTarget(data: unknown): PushTarget | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  switch (d.screen) {
    case 'user':
      return isUuid(d.userId) ? { screen: 'user', userId: d.userId } : null;
    case 'follow-requests':
      return { screen: 'follow-requests' };
    case 'activity':
      return isUuid(d.activityId) ? { screen: 'activity', activityId: d.activityId } : null;
    case 'course-day':
      return isUuid(d.courseDayId) ? { screen: 'course-day', courseDayId: d.courseDayId } : null;
    default:
      return null;
  }
}
