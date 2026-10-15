import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ACTIVITY_ICON,
  ACTIVITY_SOFT_BG,
  BadgeTile,
  CourseError,
  CourseHeader,
  ProgressBar,
} from '@/components/courses/CourseParts';
import { Button, Card, HeadlineMd, Skeleton, Text } from '@/components/ui';
import {
  useCourse,
  useCourseDays,
  useEnrollmentOp,
  useMyBadges,
  useMyEnrollments,
} from '@/hooks/useCourseQueries';
import { tr } from '@/i18n/tr';
import { groupByWeek, nextDay, progressPercent } from '@/lib/courses';
import { colors } from '@/theme/tokens';

/** Kurs detayı: katıl / ayrıl, hafta-gün listesi, ilerleme. */
export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const copy = tr.courseDetail;
  const course = useCourse(id);
  const days = useCourseDays(id);
  const enrollments = useMyEnrollments();
  const op = useEnrollmentOp();
  const badges = useMyBadges();
  const earnedBadge = badges.data?.find((b) => b.badge.course_id === id)?.badge ?? null;

  const enrollment = enrollments.data?.find((e) => e.course_id === id) ?? null;
  const completed = useMemo(() => new Set(enrollment?.completed_days ?? []), [enrollment]);
  const weeks = useMemo(() => groupByWeek(days.data ?? []), [days.data]);
  const next = nextDay(days.data ?? [], enrollment?.completed_days ?? []);
  const percent = progressPercent(days.data ?? [], enrollment?.completed_days ?? []);

  const join = () =>
    op.mutate({ op: 'join', courseId: id }, { onError: () => Alert.alert(copy.errorJoin) });

  const leave = () =>
    Alert.alert(copy.leaveTitle, copy.leaveBody, [
      { text: copy.cancel, style: 'cancel' },
      {
        text: copy.leaveConfirm,
        style: 'destructive',
        onPress: () =>
          op.mutate({ op: 'leave', courseId: id }, { onError: () => Alert.alert(copy.errorLeave) }),
      },
    ]);

  if (course.isPending) {
    return (
      <View className="flex-1 bg-canvas">
        <CourseHeader title="" />
        <View className="gap-space-md px-margin">
          <Skeleton className="h-[120px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </View>
      </View>
    );
  }
  if (course.isError || !course.data) {
    return (
      <View className="flex-1 bg-canvas">
        <CourseHeader title="" />
        {course.isError ? (
          <CourseError message={copy.errorLoad} onRetry={() => void course.refetch()} />
        ) : (
          <Text variant="body-md" className="px-margin py-space-xl text-center text-ink-secondary">
            {copy.notFound}
          </Text>
        )}
      </View>
    );
  }

  const c = course.data;
  return (
    <View className="flex-1 bg-canvas">
      <CourseHeader title={c.title} />
      <ScrollView
        contentContainerClassName="gap-space-lg px-margin"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <Card elevation="raised" className="gap-space-md p-space-md">
          <View className="flex-row items-center gap-space-md">
            <View
              className={`h-12 w-12 items-center justify-center rounded-full ${ACTIVITY_SOFT_BG[c.activity_type]}`}
            >
              <MaterialIcons
                name={ACTIVITY_ICON[c.activity_type]}
                size={26}
                color={colors.activity[c.activity_type]}
              />
            </View>
            <View className="flex-1">
              <Text variant="label-caps" className="text-brand">
                {tr.courses.level[c.level].toLocaleUpperCase('tr-TR')}
              </Text>
              <Text variant="body-md" className="text-ink-secondary">
                {tr.courses.weeksAndSessions(c.weeks, c.sessions_per_week)}
              </Text>
            </View>
          </View>
          <Text variant="body-md" className="text-ink-secondary">
            {c.description}
          </Text>
          {enrollment ? (
            <View className="gap-space-xs">
              <View className="flex-row justify-between">
                <Text variant="label-sm" className="text-ink-secondary">
                  {next
                    ? tr.courseDay.weekDay(next.week_no, next.day_no)
                    : tr.courses.completedBadge}
                </Text>
                <Text variant="label-sm" className="font-bold text-brand">
                  {tr.courses.progress(percent)}
                </Text>
              </View>
              <ProgressBar percent={percent} />
              {earnedBadge ? (
                <View className="items-center gap-space-xs py-space-sm">
                  <BadgeTile badge={earnedBadge} />
                  <Text variant="label-sm" className="text-center text-ink-secondary">
                    {tr.badges.earnedBody}
                  </Text>
                </View>
              ) : null}
              {next ? (
                <Button
                  title={tr.courses.goToWorkout}
                  className="mt-space-sm"
                  onPress={() =>
                    router.push({ pathname: '/courses/day/[id]', params: { id: next.id } })
                  }
                />
              ) : null}
              <Button title={copy.leave} variant="ghost" disabled={op.isPending} onPress={leave} />
            </View>
          ) : enrollments.isError ? (
            <CourseError message={copy.errorLoad} onRetry={() => void enrollments.refetch()} />
          ) : (
            <Button
              title={op.isPending ? copy.joining : copy.join}
              loading={op.isPending}
              disabled={enrollments.isPending}
              onPress={join}
            />
          )}
        </Card>

        {days.isPending ? (
          <Skeleton className="h-[180px] w-full" />
        ) : days.isError ? (
          <CourseError message={copy.errorLoad} onRetry={() => void days.refetch()} />
        ) : (
          weeks.map((w) => {
            const doneCount = w.days.filter((d) => completed.has(d.id)).length;
            return (
              <View key={w.weekNo} className="gap-space-sm">
                <View className="flex-row items-center justify-between">
                  <HeadlineMd>{copy.week(w.weekNo)}</HeadlineMd>
                  <Text variant="label-sm" className="text-ink-secondary">
                    {copy.weekProgress(doneCount, w.days.length)}
                  </Text>
                </View>
                <Card className="overflow-hidden">
                  {w.days.map((d, i) => {
                    const isDone = completed.has(d.id);
                    const isNext = next?.id === d.id;
                    return (
                      <Pressable
                        key={d.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${copy.dayRow(d.day_no)}. ${d.title}. ${copy.minutes(
                          d.target_duration_min,
                        )}${isDone ? `. ${copy.done}` : ''}`}
                        onPress={() =>
                          router.push({ pathname: '/courses/day/[id]', params: { id: d.id } })
                        }
                        className={`min-h-[56px] flex-row items-center gap-space-md px-space-md py-space-sm ${
                          i > 0 ? 'border-t border-hairline' : ''
                        } ${isNext ? 'bg-brand-soft' : ''}`}
                      >
                        <MaterialIcons
                          name={isDone ? 'check-circle' : 'radio-button-unchecked'}
                          size={24}
                          color={isDone ? colors.brand.DEFAULT : colors.ink.muted}
                        />
                        <View className="flex-1">
                          <Text variant="body-md-medium">{d.title}</Text>
                          <Text variant="label-sm" className="text-ink-secondary">
                            {copy.dayRow(d.day_no)} · {copy.minutes(d.target_duration_min)}
                            {isNext ? ` · ${copy.next}` : ''}
                          </Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={22} color={colors.ink.muted} />
                      </Pressable>
                    );
                  })}
                </Card>
              </View>
            );
          })
        )}

        <Text variant="label-sm" className="text-ink-secondary">
          {tr.courses.healthNote}
        </Text>
      </ScrollView>
    </View>
  );
}
