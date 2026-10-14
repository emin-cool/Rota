import {
  BURST_MAX,
  buildPushMessage,
  displayActorName,
  isDeadTokenError,
  settingForType,
  shouldThrottle,
  THROTTLE_MS,
} from './pushMessages.ts';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const ACT = '22222222-2222-4222-8222-222222222222';

describe('buildPushMessage', () => {
  it('takip: profile gider', () => {
    const m = buildPushMessage({
      type: 'follow',
      actorName: 'Ayşe',
      actorId: ACTOR,
      activityId: null,
    });
    expect(m?.body).toBe('Ayşe seni takip etmeye başladı');
    expect(m?.data).toEqual({ type: 'follow', screen: 'user', userId: ACTOR });
  });
  it('takip isteği: istekler ekranına gider', () => {
    const m = buildPushMessage({
      type: 'follow_request',
      actorName: 'Ayşe',
      actorId: ACTOR,
      activityId: null,
    });
    expect(m?.body).toBe('Ayşe seni takip etmek istiyor');
    expect(m?.data.screen).toBe('follow-requests');
  });
  it('istek kabul edildi: kabul edenin profiline gider', () => {
    const m = buildPushMessage({
      type: 'follow_accepted',
      actorName: 'Ali',
      actorId: ACTOR,
      activityId: null,
    });
    expect(m?.body).toBe('Ali takip isteğini kabul etti');
    expect(m?.data).toEqual({ type: 'follow_accepted', screen: 'user', userId: ACTOR });
  });
  it('alkış ve yorum: aktivite detayına gider, içerik metni yok', () => {
    const k = buildPushMessage({
      type: 'kudos',
      actorName: 'Ali',
      actorId: ACTOR,
      activityId: ACT,
    });
    expect(k?.body).toBe('Ali aktiviteni alkışladı');
    expect(k?.data).toEqual({ type: 'kudos', screen: 'activity', activityId: ACT });
    const c = buildPushMessage({
      type: 'comment',
      actorName: 'Ali',
      actorId: ACTOR,
      activityId: ACT,
    });
    expect(c?.body).toBe('Ali aktivitene yorum yaptı');
  });
  it('aktivite kimliği olmayan alkış/yorum gönderilmez', () => {
    expect(
      buildPushMessage({ type: 'kudos', actorName: 'A', actorId: ACTOR, activityId: null }),
    ).toBeNull();
    expect(
      buildPushMessage({ type: 'comment', actorName: 'A', actorId: ACTOR, activityId: null }),
    ).toBeNull();
  });
  it('bilinmeyen tür gönderilmez', () => {
    expect(
      buildPushMessage({
        type: 'bilinmeyen' as never,
        actorName: 'A',
        actorId: ACTOR,
        activityId: null,
      }),
    ).toBeNull();
  });
});

describe('displayActorName', () => {
  it('görünen ad önce, yoksa kullanıcı adı', () => {
    expect(displayActorName({ display_name: ' Ayşe  Y ', username: 'ayse' })).toBe('Ayşe Y');
    expect(displayActorName({ display_name: null, username: 'ayse' })).toBe('ayse');
  });
  it('boşsa nötr ifade', () => {
    expect(displayActorName({ display_name: '  ', username: '' })).toBe('Biri');
    expect(displayActorName(null)).toBe('Biri');
  });
  it('uzun adı kısaltır ve satır sonlarını temizler', () => {
    const n = displayActorName({ display_name: `${'a'.repeat(60)}\nb` });
    expect(n.length).toBeLessThanOrEqual(40);
    expect(n.includes('\n')).toBe(false);
  });
});

describe('settingForType', () => {
  it('türü doğru tercihe bağlar', () => {
    expect(settingForType('follow')).toBe('follows');
    expect(settingForType('follow_request')).toBe('follows');
    expect(settingForType('follow_accepted')).toBe('follows');
    expect(settingForType('kudos')).toBe('kudos');
    expect(settingForType('comment')).toBe('comments');
  });
});

describe('shouldThrottle', () => {
  const now = 1_000_000_000;
  it('benzer push yakın zamanda gittiyse bastırır', () => {
    expect(shouldThrottle({ lastSimilarPushedAt: now - 60_000, recentPushCount: 0, now })).toBe(
      true,
    );
  });
  it('benzer push süresi geçtiyse izin verir', () => {
    expect(
      shouldThrottle({ lastSimilarPushedAt: now - THROTTLE_MS - 1, recentPushCount: 0, now }),
    ).toBe(false);
  });
  it('hiç benzer push yoksa izin verir', () => {
    expect(shouldThrottle({ lastSimilarPushedAt: null, recentPushCount: 0, now })).toBe(false);
  });
  it('kısa sürede çok push gittiyse bastırır', () => {
    expect(shouldThrottle({ lastSimilarPushedAt: null, recentPushCount: BURST_MAX, now })).toBe(
      true,
    );
    expect(
      shouldThrottle({ lastSimilarPushedAt: null, recentPushCount: BURST_MAX - 1, now }),
    ).toBe(false);
  });
});

describe('isDeadTokenError', () => {
  it('yalnızca DeviceNotRegistered token silmeyi gerektirir', () => {
    expect(isDeadTokenError({ status: 'error', details: { error: 'DeviceNotRegistered' } })).toBe(
      true,
    );
    expect(isDeadTokenError({ status: 'error', details: { error: 'MessageRateExceeded' } })).toBe(
      false,
    );
    expect(isDeadTokenError({ status: 'ok' })).toBe(false);
  });
});
