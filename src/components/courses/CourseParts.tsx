import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, HeadlineMd, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { colors } from '@/theme/tokens';
import type { ActivityType, CourseRow } from '@/types/database';

export const ACTIVITY_ICON: Record<ActivityType, keyof typeof MaterialIcons.glyphMap> = {
  walk: 'directions-walk',
  run: 'directions-run',
  bike: 'directions-bike',
};

export const ACTIVITY_SOFT_BG: Record<ActivityType, string> = {
  walk: 'bg-activity-soft-walk',
  run: 'bg-activity-soft-run',
  bike: 'bg-activity-soft-bike',
};

/** Geri düğmeli üst çubuk (diğer ekranlarla aynı desen). */
export function CourseHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row items-center justify-between px-space-sm pb-space-sm"
      style={{ paddingTop: insets.top + 4 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr.common.back}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={8}
        className="h-11 w-11 items-center justify-center"
      >
        <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.ink.DEFAULT} />
      </Pressable>
      <HeadlineMd className="flex-1 text-center" numberOfLines={1}>
        {title}
      </HeadlineMd>
      <View className="h-11 w-11" />
    </View>
  );
}

/** Hata + "Tekrar dene". */
export function CourseError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="items-center gap-space-md px-margin py-space-xl">
      <Text variant="body-md" className="text-center text-ink-secondary">
        {message}
      </Text>
      <Button title={tr.common.retry} variant="secondary" onPress={onRetry} />
    </View>
  );
}

/** Katalog kartı: aktivite ikonu, seviye, süre, kısa açıklama. */
export function CourseCard({ course, onPress }: { course: CourseRow; onPress: () => void }) {
  const copy = tr.courses;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${course.title}. ${copy.level[course.level]}. ${copy.weeksAndSessions(
        course.weeks,
        course.sessions_per_week,
      )}`}
      onPress={onPress}
    >
      <Card elevation="raised" className="gap-space-sm p-space-md">
        <View className="flex-row items-center gap-space-md">
          <View
            className={`h-12 w-12 items-center justify-center rounded-full ${ACTIVITY_SOFT_BG[course.activity_type]}`}
          >
            <MaterialIcons
              name={ACTIVITY_ICON[course.activity_type]}
              size={26}
              color={colors.activity[course.activity_type]}
            />
          </View>
          <View className="flex-1 gap-1">
            <Text variant="label-caps" className="text-brand">
              {copy.level[course.level].toLocaleUpperCase('tr-TR')}
            </Text>
            <Text variant="body-md" className="text-ink-secondary">
              {copy.weeksAndSessions(course.weeks, course.sessions_per_week)}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.ink.muted} />
        </View>
        <Text variant="headline-sm">{course.title}</Text>
        <Text variant="body-md" className="text-ink-secondary">
          {course.description}
        </Text>
      </Card>
    </Pressable>
  );
}

/** İlerleme çubuğu (0–100). */
export function ProgressBar({ percent }: { percent: number }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      className="h-2 overflow-hidden rounded-full bg-brand-soft"
    >
      <View className="h-2 rounded-full bg-brand" style={{ width: `${percent}%` }} />
    </View>
  );
}
