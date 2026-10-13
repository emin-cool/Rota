/**
 * Hata izleme (Sentry). DSN (`EXPO_PUBLIC_SENTRY_DSN`) yoksa ya da geliştirme modundaysa hiçbir şey yapmaz.
 *
 * Gizlilik: yalnızca hata ve çökme raporu gider. IP/e-posta toplanmaz (`sendDefaultPii: false`),
 * kullanıcı yalnızca rastgele kimliğiyle işaretlenir, ağ isteği adreslerindeki sorgu parametreleri
 * (konum, filtre vb.) silinir, performans izleme kapalıdır.
 *
 * Sentry modülü yalnızca DSN varken `require` edilir: Jest testleri ve DSN'siz derlemeler native
 * modüle hiç dokunmaz.
 */
import type { ComponentType } from 'react';

type SentryModule = typeof import('@sentry/react-native');

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

let sentry: SentryModule | null = null;

/** Ağ breadcrumb'larındaki adreslerden sorgu parametrelerini ayıklar. */
export function stripQuery(url: unknown): unknown {
  return typeof url === 'string' ? url.split('?')[0] : url;
}

export function initMonitoring(): void {
  if (!DSN || __DEV__ || sentry) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sentry = require('@sentry/react-native') as SentryModule;
  sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableAutoSessionTracking: true,
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data && 'url' in breadcrumb.data) {
        return {
          ...breadcrumb,
          data: { ...breadcrumb.data, url: stripQuery(breadcrumb.data.url) },
        };
      }
      return breadcrumb;
    },
  });
}

/** Sentry bu derlemede açık mı? (DSN var ve geliştirme modunda değil) */
export function isMonitoringEnabled(): boolean {
  return sentry !== null;
}

/** Giriş yapan kullanıcıyı yalnızca kimliğiyle işaretler; çıkışta temizler. */
export function setMonitoringUser(userId: string | null): void {
  sentry?.setUser(userId ? { id: userId } : null);
}

/** Yakalanıp yutulan ama bilinmesi gereken hataları bildirir (geliştirmede konsola yazar). */
export function reportError(error: unknown, context?: string): void {
  if (__DEV__) console.warn(`[hata]${context ? ` ${context}:` : ''}`, error);
  if (!sentry) return;
  sentry.withScope((scope) => {
    if (context) scope.setTag('context', context);
    sentry!.captureException(error);
  });
}

/** Kök bileşeni Sentry ile sarar (React render hatalarını ve ekran geçişlerini yakalar). */
export function wrapRoot<T extends ComponentType<never>>(component: T): T {
  return (sentry ? (sentry.wrap(component as never) as unknown as T) : component) as T;
}
