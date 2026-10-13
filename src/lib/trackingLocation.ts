import * as Location from 'expo-location';

import { tr } from '@/i18n/tr';
import { colors } from '@/theme/tokens';

/** Arka plan görevinin adı (src/lib/trackingTask.ts içinde tanımlanır). */
export const LOCATION_TASK = 'rota-location-task';

/**
 * Konum doğruluğu. docs/03 "Balanced" diyordu, ama Balanced iOS'ta ~100 m, Android'de ağ tabanlı
 * (hücre/Wi-Fi) konum verir; bizim 25 m'lik filtremiz neredeyse tüm noktaları atardı. Fitness takibi
 * için GPS düzeyinde `High` gerekir; pili 5 m'lik mesafe aralığı, duraklatınca durdurma ve toplu yazımla koruruz.
 */
export const TRACKING_ACCURACY = Location.Accuracy.High;
export const DISTANCE_INTERVAL_M = 5;

export type TrackingPermission = 'granted' | 'denied' | 'blocked';

/**
 * Takip için ön plan konum izni (Android ön plan servisi ve iOS "uygulama kullanılırken" +
 * background mode ile ekran kilitliyken de çalışır; ayrıca "her zaman" izni istemeyiz).
 */
export async function ensureTrackingPermission(): Promise<TrackingPermission> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'blocked';
  const asked = await Location.requestForegroundPermissionsAsync();
  if (asked.granted) return 'granted';
  return asked.canAskAgain ? 'denied' : 'blocked';
}

export async function startUpdates(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: TRACKING_ACCURACY,
    distanceInterval: DISTANCE_INTERVAL_M,
    // Android: en sık bu aralıkta (ms); gereksiz uyandırmaları azaltır.
    timeInterval: 2000,
    activityType: Location.ActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: tr.live.notificationTitle,
      notificationBody: tr.live.notificationBody,
      notificationColor: colors.brand.DEFAULT,
    },
  });
}

export async function stopUpdates(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}
