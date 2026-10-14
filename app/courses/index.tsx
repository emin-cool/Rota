import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import {
  ACTIVITY_ICON,
  CourseCard,
  CourseError,
  CourseHeader,
  ProgressBar,
} from '@/components/courses/CourseParts';
import { Button, Card, Chip, Skeleton, Text } from '@/components/ui';
import { useCourseDays, useCourses, useMyEnrollments } from '@/hooks/useCourseQueries';
import { tr } from '@/i18n/tr';
import { activeEnrollment, nextDay, progressPercent } from '@/lib/courses';
import { colors } from '@/theme/tokens';
import type { ActivityType, CourseRow } from '@/types/database';

type Filter = 'all' | ActivityType;
const FILTERS: Filter[] = ['all', 'run', 'walk', 'bike'];

/** Antrenman & Kurslar: aktif program kartı + katalog. */
export default function CoursesScreen() {
  const copy = tr.courses;
  const courses = useCourses();
  const enrollments = useMyEnrollments();
  const [filter, setFilter] = useState<Filter>('all');

  const active = useMemo(() => activeEnrollment(enrollments.data ?? []), [enrollments.data]);
  const activeCourse = courses.data?.find((c) => c.id === active?.course_id) ?? null;
  const activeDays = useCourseDays(activeCourse?.id);

  const list = useMemo(
    () => (courses.data ?? []).filter((c) => filter === 'all' || c.activity_type === filter),
    [courses.data, filter],
  );

  const openCourse = (c: CourseRow) =>
    router.push({ pathname: '/courses/[id]', params: { id: c.id } });

  const header = (
    <View className="gap-space-md pb-space-md">
      <Text variant="body-md" className="text-ink-secondary">
        {copy.subtitle}
      </Text>

      {active && activeCourse ? (
        <ActiveProgramCard
          course={activeCourse}
          percent={progressPercent(activeDays.data ?? [], active.completed_days)}
          next={nextDay(activeDays.data ?? [], active.completed_days)}
          loading={activeDays.isPending}
          onOpen={() => openCourse(activeCourse)}
        />
      ) : enrollments.isPending ? (
        <Skeleton className="h-[176px] w-full" />
      ) : null}

      <Text variant="headline-sm" accessibilityRole="header">
        {copy.catalog}
      </Text>
      <View className="flex-row flex-wrap gap-space-sm">
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={copy.filters[f]}
            selected={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-canvas">
      <CourseHeader title={copy.title} />
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        contentContainerClassName="px-margin pb-space-xl"
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View className="h-space-md" />}
        renderItem={({ item }) => <CourseCard course={item} onPress={() => openCourse(item)} />}
        ListEmptyComponent={
          courses.isPending ? (
            <View className="gap-space-md">
              <Skeleton className="h-[148px] w-full" />
              <Skeleton className="h-[148px] w-full" />
            </View>
          ) : courses.isError ? (
            <CourseError message={copy.errorLoad} onRetry={() => void courses.refetch()} />
          ) : (
            <Text variant="body-md" className="py-space-lg text-center text-ink-secondary">
              {filter === 'all' ? copy.empty : copy.emptyFiltered}
            </Text>
          )
        }
        ListFooterComponent={
          <Text variant="label-sm" className="pt-space-lg text-ink-secondary">
            {copy.healthNote}
          </Text>
        }
      />
    </View>
  );
}

function ActiveProgramCard({
  course,
  percent,
  next,
  loading,
  onOpen,
}: {
  course: CourseRow;
  percent: number;
  next: ReturnType<typeof nextDay>;
  loading: boolean;
  onOpen: () => void;
}) {
  const copy = tr.courses;
  return (
    <Card elevation="raised" className="gap-space-md p-space-md">
      <View className="flex-row items-center justify-between">
        <Text variant="label-caps" className="text-brand">
          {copy.activeBadge}
        </Text>
        <MaterialIcons
          name={ACTIVITY_ICON[course.activity_type]}
          size={22}
          color={colors.activity[course.activity_type]}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        className="min-h-[44px] justify-center"
      >
        <Text variant="headline-sm">{course.title}</Text>
      </Pressable>
      <View className="gap-space-xs">
        <View className="flex-row items-center justify-between">
          <Text variant="label-sm" className="text-ink-secondary">
            {next ? tr.courseDay.weekDay(next.week_no, next.day_no) : copy.completedBadge}
          </Text>
          <Text variant="label-sm" className="font-bold text-brand">
            {copy.progress(percent)}
          </Text>
        </View>
        <ProgressBar percent={percent} />
      </View>
      {loading ? (
        <Skeleton className="h-[52px] w-full" />
      ) : next ? (
        <Button
          title={copy.goToWorkout}
          onPress={() => router.push({ pathname: '/courses/day/[id]', params: { id: next.id } })}
        />
      ) : (
        <Text variant="body-md" className="text-ink-secondary">
          {copy.completedBody}
        </Text>
      )}
    </Card>
  );
}
