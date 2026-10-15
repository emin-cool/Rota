import { parsePushTarget } from './pushTarget';

const ID = '11111111-1111-4111-8111-111111111111';

describe('parsePushTarget', () => {
  it('profil, istekler ve aktivite ekranlarını çözer', () => {
    expect(parsePushTarget({ screen: 'user', userId: ID })).toEqual({ screen: 'user', userId: ID });
    expect(parsePushTarget({ screen: 'follow-requests' })).toEqual({ screen: 'follow-requests' });
    expect(parsePushTarget({ screen: 'activity', activityId: ID })).toEqual({
      screen: 'activity',
      activityId: ID,
    });
  });

  it('kurs günü ekranını çözer', () => {
    expect(parsePushTarget({ screen: 'course-day', courseDayId: ID })).toEqual({
      screen: 'course-day',
      courseDayId: ID,
    });
    expect(parsePushTarget({ screen: 'course-day', courseDayId: '../x' })).toBeNull();
    expect(parsePushTarget({ screen: 'course-day' })).toBeNull();
  });

  it('UUID olmayan kimlikleri reddeder (yol enjeksiyonu olmasın)', () => {
    expect(parsePushTarget({ screen: 'user', userId: '../settings' })).toBeNull();
    expect(parsePushTarget({ screen: 'activity', activityId: 'abc' })).toBeNull();
    expect(parsePushTarget({ screen: 'user' })).toBeNull();
  });

  it('bilinmeyen ekran ve geçersiz veriyi reddeder', () => {
    expect(parsePushTarget({ screen: 'settings' })).toBeNull();
    expect(parsePushTarget(null)).toBeNull();
    expect(parsePushTarget('x')).toBeNull();
    expect(parsePushTarget(undefined)).toBeNull();
  });
});
