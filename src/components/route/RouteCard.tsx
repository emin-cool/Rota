import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { formatDistance, formatDuration, formatRating } from '@/lib/geo';
import { colors } from '@/theme/tokens';
import type { ActivityType, NearbyRoute } from '@/types/database';

const ACTIVITY_ICON: Record<ActivityType, keyof typeof MaterialIcons.glyphMap> = {
  walk: 'directions-walk',
  run: 'directions-run',
  bike: 'directions-bike',
};

// Tailwind statik tarandığı için sınıf adları tam yazıldı.
const ACTIVITY_SOFT_BG: Record<ActivityType, string> = {
  walk: 'bg-activity-soft-walk',
  run: 'bg-activity-soft-run',
  bike: 'bg-activity-soft-bike',
};

/** Alt sheet'teki yatay kaydırmalı rota kartı. Fotoğraf gelene kadar aktivite renkli üst blok. */
export function RouteCard({ route, onPress }: { route: NearbyRoute; onPress: () => void }) {
  const difficulty = route.difficulty ? tr.map.difficulty[route.difficulty] : null;
  const meta = [
    formatDistance(route.distance_m),
    route.est_duration_min ? formatDuration(route.est_duration_min) : null,
    difficulty,
  ].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr.map.routeOf(route.title, formatRating(route.avg_rating))}
      onPress={onPress}
      className="w-[280px]"
    >
      <Card elevation="raised" className="overflow-hidden">
        <View
          className={`h-24 items-center justify-center ${ACTIVITY_SOFT_BG[route.activity_type]}`}
        >
          <MaterialIcons
            name={ACTIVITY_ICON[route.activity_type]}
            size={40}
            color={colors.activity[route.activity_type]}
          />
          <View className="absolute right-3 top-3 flex-row items-center gap-1 rounded-full bg-white/90 px-2.5 py-1">
            <MaterialIcons name="star" size={14} color={colors.accent.DEFAULT} />
            <Text variant="label-sm" className="font-bold">
              {formatRating(route.avg_rating)}
            </Text>
            <Text variant="label-sm" className="text-ink-secondary">
              ({route.rating_count})
            </Text>
          </View>
        </View>
        <View className="gap-1 p-space-md">
          <Text variant="headline-sm" numberOfLines={1}>
            {route.title}
          </Text>
          <Text variant="body-md" className="text-ink-secondary">
            {meta.join(' • ')}
          </Text>
          {route.district ? (
            <View className="mt-1 self-start rounded-full bg-surface-container px-2.5 py-1">
              <Text variant="label-sm" className="text-ink-secondary">
                {route.district}
              </Text>
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
