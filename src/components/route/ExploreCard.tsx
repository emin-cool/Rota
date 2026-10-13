import { MaterialIcons } from '@expo/vector-icons';
import { Image, Pressable, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { formatDistance, formatDuration, formatRating } from '@/lib/geo';
import { colors } from '@/theme/tokens';
import type { ActivityType, ExploreRoute } from '@/types/database';

export const ACTIVITY_ICON: Record<ActivityType, keyof typeof MaterialIcons.glyphMap> = {
  walk: 'directions-walk',
  run: 'directions-run',
  bike: 'directions-bike',
};

// Tailwind statik tarandığı için sınıf adları tam yazıldı.
export const ACTIVITY_SOFT_BG: Record<ActivityType, string> = {
  walk: 'bg-activity-soft-walk',
  run: 'bg-activity-soft-run',
  bike: 'bg-activity-soft-bike',
};

/** Kart üst görseli: ilk fotoğraf, yoksa aktivite renkli yer tutucu. */
export function CoverImage({
  route,
  className,
}: {
  route: Pick<ExploreRoute, 'cover_url' | 'activity_type'>;
  className: string;
}) {
  if (route.cover_url) {
    return (
      <Image
        source={{ uri: route.cover_url }}
        className={className}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View
      className={`items-center justify-center ${ACTIVITY_SOFT_BG[route.activity_type]} ${className}`}
    >
      <MaterialIcons
        name={ACTIVITY_ICON[route.activity_type]}
        size={44}
        color={colors.activity[route.activity_type]}
      />
    </View>
  );
}

export function HeartButton({ saved, onPress }: { saved: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? tr.explore.unsave : tr.explore.save}
      accessibilityState={{ selected: saved }}
      onPress={onPress}
      hitSlop={4}
      className="h-11 w-11 items-center justify-center rounded-full bg-white/90"
    >
      <MaterialIcons
        name={saved ? 'favorite' : 'favorite-border'}
        size={22}
        color={saved ? colors.accent.DEFAULT : colors.ink.secondary}
      />
    </Pressable>
  );
}

function RatingBadge({ route }: { route: ExploreRoute }) {
  if (route.rating_count === 0) return null;
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-black/55 px-2.5 py-1">
      <MaterialIcons name="star" size={14} color="#fff" />
      <Text variant="label-sm" className="font-bold text-white">
        {formatRating(route.avg_rating)} ({route.rating_count})
      </Text>
    </View>
  );
}

function Meta({ icon, text }: { icon: keyof typeof MaterialIcons.glyphMap; text: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <MaterialIcons name={icon} size={18} color={colors.brand.DEFAULT} />
      <Text variant="body-md-medium">{text}</Text>
    </View>
  );
}

type Props = {
  route: ExploreRoute;
  onPress: () => void;
  onToggleSave: () => void;
};

/** Keşfet listesi kartı (Stitch "Bu hafta popüler"). */
export function ExploreCard({ route, onPress, onToggleSave }: Props) {
  const difficulty = route.difficulty ? tr.detail.difficulty[route.difficulty] : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr.map.routeOf(route.title, formatRating(route.avg_rating))}
      onPress={onPress}
    >
      <Card elevation="raised" className="overflow-hidden">
        <View>
          <CoverImage route={route} className="h-44 w-full" />
          <View className="absolute right-3 top-3">
            <HeartButton saved={route.saved} onPress={onToggleSave} />
          </View>
          <View className="absolute inset-x-3 bottom-3 flex-row items-end justify-between gap-2">
            <View className="shrink rounded-md bg-black/45 px-2 py-1">
              {route.district ? (
                <Text variant="label-caps" className="text-white" numberOfLines={1}>
                  {route.district}
                </Text>
              ) : null}
              <Text variant="headline-sm" className="text-white" numberOfLines={2}>
                {route.title}
              </Text>
            </View>
            <RatingBadge route={route} />
          </View>
        </View>
        <View className="flex-row items-center gap-space-md px-space-md py-space-md">
          <Meta icon="straighten" text={formatDistance(route.distance_m)} />
          {route.est_duration_min ? (
            <Meta icon="schedule" text={formatDuration(route.est_duration_min)} />
          ) : null}
          {difficulty ? <Meta icon="terrain" text={difficulty} /> : null}
          <View className="flex-1" />
          <MaterialIcons name="arrow-forward" size={20} color={colors.ink.muted} />
        </View>
      </Card>
    </Pressable>
  );
}

/** Yatay kaydırmalı "Editörün seçtikleri" kartı. */
export function FeaturedCard({ route, onPress, onToggleSave }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr.map.routeOf(route.title, formatRating(route.avg_rating))}
      onPress={onPress}
      className="w-[280px]"
    >
      <Card elevation="raised" className="overflow-hidden">
        <View>
          <CoverImage route={route} className="h-32 w-full" />
          <View className="absolute right-2 top-2">
            <HeartButton saved={route.saved} onPress={onToggleSave} />
          </View>
          <View className="absolute bottom-2 left-3">
            <RatingBadge route={route} />
          </View>
        </View>
        <View className="gap-1 p-space-md">
          <Text variant="headline-sm" numberOfLines={1}>
            {route.title}
          </Text>
          {route.district ? (
            <Text variant="body-md" className="text-ink-secondary" numberOfLines={1}>
              {route.district}
            </Text>
          ) : null}
          <Text variant="body-md-medium" className="text-brand">
            {formatDistance(route.distance_m)}
            {route.est_duration_min ? `  ·  ${formatDuration(route.est_duration_min)}` : ''}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
