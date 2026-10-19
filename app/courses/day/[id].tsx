import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ACTIVITY_ICON, CourseError, CourseHeader } from '@/components/courses/CourseParts';
import { Button, Card, HeadlineMd, Skeleton, Text } from '@/components/ui';
import { useCourse, useCourseDay, useCourseDays, useMyEnrollments } from '@/hooks/useCourseQueries';
import { useStartActivity } from '@/hooks/useStartActivity';
import { useNowSec } from '@/hooks/useNowSec';
import { useLocalWeather } from '@/hooks/useWeather';
import { tr } from '@/i18n/tr';
import {
  effortSplit,
  formatPhaseDuration,
  sortDays,
  wizardPatchForDay,
  workoutTotalSec,
} from '@/lib/courses';
import { useCourseSessionStore } from '@/stores/courseSessionStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useWizardStore } from '@/stores/wizardStore';
import { hoursFrom, workoutHint } from '@/lib/weather';
import { colors } from '@/theme/tokens';
import type { WorkoutPhase, WorkoutPhaseType } from '@/types/database';

const PHASE_ICON: Record<WorkoutPhaseType, keyof typeof MaterialIcons.glyphMap> = {
  warmup: 'self-improvement',
  run: 'directions-run',
  walk: 'directions-walk',
  ride: 'directions-bike',
  cooldown: 'spa',
};

/** Antrenman günü: faz akışı, ipucu, "rota bul" ve serbest başlat. */
export default function CourseDayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const copy = tr.courseDay;
  const day = useCourseDay(id);
  const course = useCourse(day.data?.course_id);
  const days = useCourseDays(day.data?.course_id);
  const enrollments = useMyEnrollments();
  const weather = useLocalWeather();
  const nowSec = useNowSec();
  const profile = useSessionStore((s) => s.profile);
  const { start, starting } = useStartActivity();

  const enrollment = enrollments.data?.find((e) => e.course_id === day.data?.course_id) ?? null;
  const isDone = !!id && !!enrollment?.completed_days.includes(id);
  const position = useMemo(() => {
    const sorted = sortDays(days.data ?? []);
    return { index: sorted.findIndex((d) => d.id === id) + 1, total: sorted.length };
  }, [days.data, id]);

  if (day.isPending) {
    return (
      <View className="flex-1 bg-canvas">
        <CourseHeader title="" />
        <View className="gap-space-md px-margin">
          <Skeleton className="h-[120px] w-full" />
          <Skeleton className="h-[240px] w-full" />
        </View>
      </View>
    );
  }
  if (day.isError || !day.data) {
    return (
      <View className="flex-1 bg-canvas">
        <CourseHeader title="" />
        {day.isError ? (
          <CourseError message={copy.errorLoad} onRetry={() => void day.refetch()} />
        ) : (
          <Text variant="body-md" className="px-margin py-space-xl text-center text-ink-secondary">
            {copy.notFound}
          </Text>
        )}
      </View>
    );
  }

  const d = day.data;
  const upcoming = weather.data ? hoursFrom(weather.data.weather.hourly, nowSec, 6) : [];
  const weatherHint = upcoming.length > 0 ? workoutHint(upcoming) : null;
  const activityType = course.data?.activity_type ?? 'walk';
  const split = effortSplit(d.workout_json);
  const totalMin = Math.round(workoutTotalSec(d.workout_json) / 60);
  const canStart = !!enrollment;

  const findRoute = () => {
    useWizardStore.getState().reset(profile);
    useWizardStore.getState().patch(wizardPatchForDay(activityType, d));
    useCourseSessionStore.getState().set({ courseDayId: d.id, workout: d.workout_json });
    router.push('/route-wizard/step-1');
  };

  const startFree = () => {
    useCourseSessionStore.getState().clear();
    void start({ activityType, courseDayId: d.id, workout: d.workout_json });
  };

  return (
    <View className="flex-1 bg-canvas">
      <CourseHeader title={course.data?.title ?? ''} />
      <ScrollView
        contentContainerClassName="gap-space-lg px-margin"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <View className="gap-space-xs">
          {course.data ? (
            <Text variant="label-caps" className="text-brand">
              {copy.badge(course.data.title)}
              {position.index > 0 ? ` · ${copy.position(position.index, position.total)}` : ''}
            </Text>
          ) : null}
          <Text variant="body-md" className="text-ink-secondary">
            {copy.weekDay(d.week_no, d.day_no)}
          </Text>
          <HeadlineMd>{d.title}</HeadlineMd>
        </View>

        {weatherHint ? (
          <View className="flex-row items-center gap-space-sm" accessibilityLabel={weatherHint}>
            <MaterialIcons name="wb-sunny" size={18} color={colors.accent.deep} />
            <Text variant="label-sm" className="flex-1 text-ink-secondary">
              {weatherHint}
            </Text>
          </View>
        ) : null}

        <Card className="gap-space-sm p-space-md">
          <View className="flex-row items-center justify-between">
            <Text variant="label-sm" className="text-ink-secondary">
              {copy.total}
            </Text>
            <Text variant="headline-sm">{tr.courseDetail.minutes(totalMin)}</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text variant="label-sm" className="text-ink-secondary">
              {copy.effort}
            </Text>
            <Text variant="body-md-medium">
              {copy.effortLine(split.effortMin, split.walkMin, copy.effortLabel[activityType])}
            </Text>
          </View>
        </Card>

        <View className="gap-space-sm">
          <View className="flex-row items-center justify-between">
            <HeadlineMd>{copy.flow}</HeadlineMd>
            <Text variant="label-sm" className="text-ink-secondary">
              {copy.phases(d.workout_json.length)}
            </Text>
          </View>
          {d.workout_json.map((phase, i) => (
            <PhaseRow key={i} phase={phase} />
          ))}
        </View>

        {d.coach_tip ? (
          <Card className="flex-row gap-space-md bg-brand-soft p-space-md">
            <MaterialIcons name="tips-and-updates" size={22} color={colors.brand.DEFAULT} />
            <View className="flex-1 gap-1">
              <Text variant="label-caps" className="text-brand">
                {copy.coachTip.toLocaleUpperCase('tr-TR')}
              </Text>
              <Text variant="body-md">{d.coach_tip}</Text>
            </View>
          </Card>
        ) : null}

        {isDone ? (
          <View className="flex-row items-center gap-space-sm">
            <MaterialIcons name="check-circle" size={20} color={colors.brand.DEFAULT} />
            <Text variant="body-md" className="flex-1 text-ink-secondary">
              {copy.completedHint}
            </Text>
          </View>
        ) : null}

        {canStart ? (
          <View className="gap-space-sm">
            <Button
              title={copy.findRoute}
              leading={<MaterialIcons name="map" size={20} color={colors.white} />}
              onPress={findRoute}
            />
            <Text variant="label-sm" className="text-center text-ink-secondary">
              {copy.findRouteHint(d.target_duration_min)}
            </Text>
            <Button
              title={copy.startFree}
              variant="secondary"
              loading={starting}
              leading={
                <MaterialIcons
                  name={ACTIVITY_ICON[activityType]}
                  size={20}
                  color={colors.brand.DEFAULT}
                />
              }
              onPress={startFree}
            />
          </View>
        ) : (
          <View className="gap-space-sm">
            <Text variant="body-md" className="text-center text-ink-secondary">
              {enrollments.isPending ? tr.common.loading : copy.notEnrolled}
            </Text>
            <Button
              title={copy.goToCourse}
              variant="secondary"
              disabled={enrollments.isPending}
              onPress={() =>
                router.replace({ pathname: '/courses/[id]', params: { id: d.course_id } })
              }
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function PhaseRow({ phase }: { phase: WorkoutPhase }) {
  const copy = tr.courseDay;
  const isInterval = (phase.repeat ?? 1) > 1 && !!phase.rest;
  const label = copy.phase[phase.type];
  const main = `${formatPhaseDuration(phase.duration_sec)} ${label.toLocaleLowerCase('tr-TR')}`;
  const rest = phase.rest
    ? `${formatPhaseDuration(phase.rest.duration_sec)} ${copy.phase[phase.rest.type].toLocaleLowerCase('tr-TR')}`
    : '';
  return (
    <Card className="flex-row items-center gap-space-md p-space-md">
      <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-soft">
        <MaterialIcons name={PHASE_ICON[phase.type]} size={22} color={colors.brand.DEFAULT} />
      </View>
      <View className="flex-1">
        <Text variant="body-md-medium">
          {isInterval ? copy.repeatLine(phase.repeat!, main, rest) : main}
        </Text>
        {isInterval ? (
          <Text variant="label-sm" className="text-ink-secondary">
            {copy.repeat(phase.repeat!)}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
