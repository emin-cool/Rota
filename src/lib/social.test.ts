import {
  activityTitle,
  followButtonFor,
  formatCount,
  isNewerThan,
  nextFeedCursor,
  normalizeComment,
  withKudos,
} from './social';
import type { FeedActivity } from '@/types/database';

describe('followButtonFor', () => {
  it('her durum doğru işlemi ve etiketi verir', () => {
    expect(followButtonFor('none')).toEqual({ action: 'follow', label: 'follow', primary: true });
    expect(followButtonFor('following')).toMatchObject({
      action: 'unfollow',
      label: 'following',
      primary: false,
    });
    expect(followButtonFor('pending')).toMatchObject({ action: 'cancel', label: 'requested' });
    expect(followButtonFor('requested_me')).toMatchObject({
      action: 'accept',
      label: 'accept',
      primary: true,
    });
    expect(followButtonFor('self').action).toBe('none');
  });
});

describe('formatCount', () => {
  it('kısaltır', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
    expect(formatCount(1000)).toBe('1 B');
    expect(formatCount(1250)).toBe('1,3 B');
    expect(formatCount(48_200)).toBe('48,2 B');
    expect(formatCount(1_250_000)).toBe('1,3 Mn');
  });
});

describe('withKudos', () => {
  it('alkış ekler/geri alır, sayı eksiye düşmez, aynı duruma dokunmaz', () => {
    const a = { kudosed: false, kudos_count: 2 };
    expect(withKudos(a, true)).toEqual({ kudosed: true, kudos_count: 3 });
    expect(withKudos({ kudosed: true, kudos_count: 3 }, false)).toEqual({
      kudosed: false,
      kudos_count: 2,
    });
    expect(withKudos({ kudosed: true, kudos_count: 0 }, false).kudos_count).toBe(0);
    expect(withKudos(a, false)).toBe(a);
  });
});

describe('nextFeedCursor', () => {
  const row = (t: string) => ({ created_at: t }) as FeedActivity;
  it('tam sayfada son kartın zamanı, eksik sayfada undefined', () => {
    expect(nextFeedCursor([row('a'), row('b')], 2)).toBe('b');
    expect(nextFeedCursor([row('a')], 2)).toBeUndefined();
    expect(nextFeedCursor([], 2)).toBeUndefined();
  });
});

describe('normalizeComment / activityTitle / isNewerThan', () => {
  it('yorum kırpılır ve sınırlar uygulanır', () => {
    expect(normalizeComment('  selam  ')).toBe('selam');
    expect(normalizeComment('   ')).toBeNull();
    expect(normalizeComment('x'.repeat(501))).toBeNull();
    expect(normalizeComment('x'.repeat(500))).toHaveLength(500);
  });
  it('başlık yoksa türden ad', () => {
    const names = { walk: 'Yürüyüş', run: 'Koşu', bike: 'Bisiklet' } as const;
    expect(activityTitle({ title: ' Sabah ', activity_type: 'run' }, names)).toBe('Sabah');
    expect(activityTitle({ title: null, activity_type: 'bike' }, names)).toBe('Bisiklet');
    expect(activityTitle({ title: '  ', activity_type: 'walk' }, names)).toBe('Yürüyüş');
  });
  it('yeni kayıt kontrolü', () => {
    expect(isNewerThan('2026-10-14T10:00:00Z', '2026-10-14T09:00:00Z')).toBe(true);
    expect(isNewerThan('2026-10-14T08:00:00Z', '2026-10-14T09:00:00Z')).toBe(false);
    expect(isNewerThan('2026-10-14T08:00:00Z', null)).toBe(false);
  });
});
