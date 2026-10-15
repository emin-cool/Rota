// Kurs hatırlatıcısı: cihazda zamanlanan YEREL bildirimler (sunucu push'u değil). Yalnızca gerçek cihazda çalışır.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { tr } from '@/i18n/tr';
import { isPushSupported } from '@/lib/push';

const KIND = 'course-reminder';
const ANDROID_CHANNEL = 'default';

/** Eşzamanlı iki zamanlama birbirinin bildirimlerini çiftlemesin diye sıraya dizilir. */
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function cancelAll(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => (n.content.data as { kind?: string } | null)?.kind === KIND)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Zamanlanmış tüm kurs hatırlatıcılarını iptal eder. */
export function cancelCourseReminders(): Promise<void> {
  if (!isPushSupported()) return Promise.resolve();
  return exclusive(cancelAll);
}

/** Eski hatırlatıcıları silip verilen zamanlar için yenilerini kurar. */
export function scheduleCourseReminders(params: {
  dates: Date[];
  courseDayId: string;
  /** "Hafta 2 · Gün 3" */
  dayLabel: string;
  dayTitle: string;
}): Promise<void> {
  if (!isPushSupported()) return Promise.resolve();
  return exclusive(async () => {
    await cancelAll();
    if (params.dates.length === 0) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: 'Genel',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const copy = tr.courseReminder;
    for (const date of params.dates) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: copy.notifTitle,
          body: copy.notifBody(params.dayLabel, params.dayTitle),
          data: { kind: KIND, screen: 'course-day', courseDayId: params.courseDayId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: ANDROID_CHANNEL,
        },
      });
    }
  });
}
