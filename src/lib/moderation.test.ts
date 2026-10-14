import { canModerate, REPORT_REASONS, reportErrorKey, type ModerationTarget } from './moderation';

const target: ModerationTarget = {
  type: 'comment',
  targetId: 'c1',
  ownerId: 'u2',
  ownerName: 'Ayşe',
};

describe('canModerate', () => {
  it('başkasının içeriğinde açık, kendi içeriğinde ve oturumsuz kapalı', () => {
    expect(canModerate(target, 'u1')).toBe(true);
    expect(canModerate(target, 'u2')).toBe(false);
    expect(canModerate(target, null)).toBe(false);
    expect(canModerate(target, undefined)).toBe(false);
  });
});

describe('REPORT_REASONS', () => {
  it('sunucudaki sebeplerle aynı beş değer', () => {
    expect(REPORT_REASONS).toEqual(['spam', 'harassment', 'inappropriate', 'dangerous', 'other']);
  });
});

describe('reportErrorKey', () => {
  it('sunucu hata mesajlarını anahtara çevirir', () => {
    expect(reportErrorKey('rate_limited')).toBe('rateLimited');
    expect(reportErrorKey('not_found')).toBe('notFound');
    expect(reportErrorKey('own_content')).toBe('notFound');
    expect(reportErrorKey('beklenmeyen')).toBe('generic');
    expect(reportErrorKey(undefined)).toBe('generic');
  });
});
