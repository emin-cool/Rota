import {
  isMonitoringEnabled,
  reportError,
  setMonitoringUser,
  stripQuery,
  wrapRoot,
} from './monitoring';

describe('monitoring (DSN yokken)', () => {
  it('Sentry kapalıdır ve hiçbir çağrı hata vermez', () => {
    expect(isMonitoringEnabled()).toBe(false);
    expect(() => reportError(new Error('x'), 'test')).not.toThrow();
    expect(() => setMonitoringUser('u1')).not.toThrow();
    expect(() => setMonitoringUser(null)).not.toThrow();
  });

  it('wrapRoot bileşeni olduğu gibi döndürür', () => {
    const Comp = () => null;
    expect(wrapRoot(Comp)).toBe(Comp);
  });
});

describe('stripQuery', () => {
  it('adresteki sorgu parametrelerini (konum, filtre) siler', () => {
    expect(stripQuery('https://x.supabase.co/rest/v1/activities?user_id=eq.1&lng=29.0')).toBe(
      'https://x.supabase.co/rest/v1/activities',
    );
    expect(stripQuery('https://x.co/a')).toBe('https://x.co/a');
  });
  it('metin olmayan değere dokunmaz', () => {
    expect(stripQuery(undefined)).toBeUndefined();
    expect(stripQuery(5)).toBe(5);
  });
});
