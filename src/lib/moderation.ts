import type { ReportReason, ReportType } from '@/types/database';

/** Bildirme sebepleri (sunucudaki `reports.reason` check'iyle aynı sırayla). */
export const REPORT_REASONS: ReportReason[] = [
  'spam',
  'harassment',
  'inappropriate',
  'dangerous',
  'other',
];

/** Menüde gösterilecek hedef: neyi bildiriyoruz ve içeriğin sahibi kim. */
export type ModerationTarget = {
  type: ReportType;
  targetId: string;
  ownerId: string;
  ownerName: string;
};

/** Kendi içeriğini bildirme/engelleme yok; oturum yoksa da yok. */
export function canModerate(target: ModerationTarget, myId: string | null | undefined): boolean {
  return !!myId && target.ownerId !== myId;
}

/** Sunucu `report_content` hatalarını (RAISE EXCEPTION mesajı) kullanıcıya dönük anahtara çevirir. */
export function reportErrorKey(
  message: string | undefined,
): 'rateLimited' | 'notFound' | 'generic' {
  if (!message) return 'generic';
  if (message.includes('rate_limited')) return 'rateLimited';
  if (message.includes('not_found') || message.includes('own_content')) return 'notFound';
  return 'generic';
}
