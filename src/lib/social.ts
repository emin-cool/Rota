import type { ActivityType, FeedActivity, FollowState } from '@/types/database';

/** Takip düğmesinin ne yapacağı ve ne yazacağı (durum makinesi). */
export type FollowAction = 'follow' | 'unfollow' | 'cancel' | 'accept' | 'none';

export type FollowButton = {
  /** Düğmeye basınca yapılacak işlem; 'none' → düğme gösterilmez. */
  action: FollowAction;
  label: 'follow' | 'following' | 'requested' | 'accept';
  /** Dolu (birincil) mi, çerçeveli mi çizilsin. */
  primary: boolean;
};

export function followButtonFor(state: FollowState): FollowButton {
  switch (state) {
    case 'self':
      return { action: 'none', label: 'follow', primary: false };
    case 'following':
      return { action: 'unfollow', label: 'following', primary: false };
    case 'pending':
      return { action: 'cancel', label: 'requested', primary: false };
    case 'requested_me':
      return { action: 'accept', label: 'accept', primary: true };
    default:
      return { action: 'follow', label: 'follow', primary: true };
  }
}

/** 1250 → "1,2 B"; 1_200_000 → "1,2 Mn"; 999 → "999". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  const compact = (v: number, unit: string) =>
    `${(Math.round(v * 10) / 10).toString().replace('.', ',')} ${unit}`;
  if (n < 1_000_000) return compact(n / 1000, 'B');
  return compact(n / 1_000_000, 'Mn');
}

export type FeedFilter = 'all' | ActivityType;
export const FEED_FILTERS: FeedFilter[] = ['all', 'run', 'bike', 'walk'];

/** Akış sayfalama imleci: son kartın created_at'i. */
export function nextFeedCursor(page: FeedActivity[], pageSize: number): string | undefined {
  return page.length >= pageSize ? page[page.length - 1]!.created_at : undefined;
}

/** Alkış sayısını iyimser güncelle (ekranda hemen değişsin). */
export function withKudos<T extends Pick<FeedActivity, 'kudosed' | 'kudos_count'>>(
  a: T,
  on: boolean,
): T {
  if (a.kudosed === on) return a;
  return { ...a, kudosed: on, kudos_count: Math.max(0, a.kudos_count + (on ? 1 : -1)) };
}

/** Aktivite başlığı yoksa türünden bir ad. */
export function activityTitle(
  a: Pick<FeedActivity, 'title' | 'activity_type'>,
  names: Record<ActivityType, string>,
): string {
  return a.title?.trim() || names[a.activity_type];
}

/** Yorum kutusu: baştaki/sondaki boşluk kırpılır, 1–500 karakter. */
export function normalizeComment(raw: string): string | null {
  const t = raw.trim();
  return t.length >= 1 && t.length <= 500 ? t : null;
}

/** İki yeni gönderi imlecini karşılaştırır: akışın en yenisinden sonra gelen kayıt var mı. */
export function isNewerThan(createdAt: string, newestSeen: string | null): boolean {
  if (!newestSeen) return false;
  return new Date(createdAt).getTime() > new Date(newestSeen).getTime();
}
