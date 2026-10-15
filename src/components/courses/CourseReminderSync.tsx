import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';

import { useCourseDays } from '@/hooks/useCourseQueries';
import { tr } from '@/i18n/tr';
import { activeEnrollment, nextDay } from '@/lib/courses';
import { planReminderDates } from '@/lib/courseReminder';
import { onCourseDayCompleted } from '@/lib/courseEvents';
import { cancelCourseReminders, scheduleCourseReminders } from '@/lib/courseReminderScheduler';
import { fetchMyEnrollments, hasCourseWorkoutToday } from '@/lib/coursesApi';
import { reportError } from '@/lib/monitoring';
import { getPushPermission } from '@/lib/push';
import { useCourseReminderStore } from '@/stores/courseReminderStore';
import { useSessionStore } from '@/stores/sessionStore';

/**
 * Görünmez bileşen: aktif programın sıradaki antrenmanı ve hatırlatıcı ayarları değişince, uygulama öne
 * gelince ve bir antrenman tamamlanınca yerel hatırlatıcıları yeniden kurar. Çıkış yapılınca iptal eder.
 * Kurs bitirme rozeti kazanıldığında kısa bir kutlama uyarısı da buradan gösterilir.
 */
export function CourseReminderSync() {
  const userId = useSessionStore((s) => s.session?.user.id);
  const qc = useQueryClient();
  const { settings, loaded, load } = useCourseReminderStore();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    void load();
  }, [load]);

  // Ortak anahtar: kurs ekranlarındaki `useMyEnrollments` ile aynı önbelleği paylaşır.
  const enrollments = useQuery({
    queryKey: ['enrollments', userId],
    enabled: !!userId,
    queryFn: fetchMyEnrollments,
  });
  const active = activeEnrollment(enrollments.data ?? []);
  const days = useCourseDays(active?.course_id);
  const next = nextDay(days.data ?? [], active?.completed_days ?? []);

  useEffect(() => {
    const appState = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      void qc.invalidateQueries({ queryKey: ['enrollments', userId] });
      setTick((t) => t + 1);
    });
    const completed = onCourseDayCompleted(({ courseFinished }) => {
      void qc.invalidateQueries({ queryKey: ['enrollments', userId] });
      void qc.invalidateQueries({ queryKey: ['my-badges', userId] });
      setTick((t) => t + 1);
      if (courseFinished) Alert.alert(tr.badges.earnedTitle, tr.badges.earnedBody);
    });
    return () => {
      appState.remove();
      completed();
    };
  }, [qc, userId]);

  const waiting =
    enrollments.isPending || enrollments.isError || (!!active && (days.isPending || days.isError));
  const completedCount = active?.completed_days.length ?? 0;

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    void (async () => {
      if (!userId) return void (await cancelCourseReminders());
      if (waiting) return; // veri gelmeden (ya da çevrimdışıyken) mevcut hatırlatıcıları bozma
      if (!settings.enabled || !next || (await getPushPermission()) !== 'granted') {
        return void (await cancelCourseReminders());
      }
      const completedToday = await hasCourseWorkoutToday(userId);
      if (cancelled) return;
      await scheduleCourseReminders({
        dates: planReminderDates({ now: new Date(), settings, completedToday }),
        courseDayId: next.id,
        dayLabel: tr.courseDay.weekDay(next.week_no, next.day_no),
        dayTitle: next.title,
      });
    })().catch((e) => reportError(e, 'course-reminder-sync'));
    return () => {
      cancelled = true;
    };
    // `next` nesnesi yerine kimliği izlenir; tamamlanan gün sayısı da sıradaki günü değiştirir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, settings, userId, waiting, next?.id, completedCount, tick]);

  return null;
}
