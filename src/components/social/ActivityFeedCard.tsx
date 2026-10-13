import { MaterialIcons } from '@expo/vector-icons';
import { memo } from 'react';
import { Image, Pressable, View } from 'react-native';

import { ACTIVITY_ICON, ACTIVITY_SOFT_BG } from '@/components/route/ExploreCard';
import { Avatar, Card, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { timeAgo } from '@/lib/explore';
import { formatDistance, formatDuration } from '@/lib/geo';
import { formatPace } from '@/lib/pace';
import { activityTitle, formatCount } from '@/lib/social';
import { colors } from '@/theme/tokens';
import type { FeedActivity } from '@/types/database';

import { TrackThumb } from './TrackThumb';

/** Stat sütunları: yürüyüş/koşuda tempo, bisiklette ortalama hız. */
export function activityStats(a: FeedActivity): { label: string; value: string }[] {
  const pace =
    a.activity_type === 'bike'
      ? {
          label: tr.social.speed,
          value: `${((a.distance_m / Math.max(a.duration_sec, 1)) * 3.6).toFixed(1).replace('.', ',')} km/s`,
        }
      : {
          label: tr.social.pace,
          value: a.avg_pace_sec_per_km ? `${formatPace(a.avg_pace_sec_per_km)} /km` : '—',
        };
  return [
    { label: tr.social.distance, value: formatDistance(a.distance_m) },
    { label: tr.social.duration, value: formatDuration(a.duration_sec / 60) },
    pace,
    { label: tr.social.ascent, value: `+${a.elevation_gain_m} m` },
  ];
}

export function ActivityHeader({
  a,
  onOpenProfile,
}: {
  a: FeedActivity;
  onOpenProfile: (userId: string) => void;
}) {
  return (
    <View className="flex-row items-center gap-space-md">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a.display_name}
        onPress={() => onOpenProfile(a.user_id)}
        className="min-h-[48px] flex-1 flex-row items-center gap-space-md"
      >
        <View>
          <Avatar name={a.display_name} uri={a.avatar_url} size={44} />
          <View
            className={`absolute -bottom-1 -right-1 h-5 w-5 items-center justify-center rounded-full ${ACTIVITY_SOFT_BG[a.activity_type]}`}
          >
            <MaterialIcons
              name={ACTIVITY_ICON[a.activity_type]}
              size={12}
              color={colors.activity[a.activity_type]}
            />
          </View>
        </View>
        <View className="flex-1">
          <Text variant="body-lg" className="font-bold" numberOfLines={1}>
            {a.mine ? tr.social.you : a.display_name}
          </Text>
          <Text variant="label-sm" className="text-ink-secondary" numberOfLines={1}>
            {timeAgo(a.created_at)}
            {a.district ? ` · ${a.district}` : ''}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

type Props = {
  activity: FeedActivity;
  /** Kararlı (useCallback) işlevler: kartlar memo'lu. */
  onOpen: (id: string) => void;
  onOpenProfile: (userId: string) => void;
  onToggleKudos: (activity: FeedActivity) => void;
  onShare: (activity: FeedActivity) => void;
};

/** Akış kartı (Stitch "Son Aktiviteler"): kişi, başlık, not, iz + fotoğraf, istatistik, alkış/yorum/paylaş. */
export const ActivityFeedCard = memo(function ActivityFeedCard({
  activity: a,
  onOpen,
  onOpenProfile,
  onToggleKudos,
  onShare,
}: Props) {
  const title = activityTitle(a, tr.social.untitled);
  const photo = a.photos[0];
  return (
    <Card elevation="raised" className="gap-space-md p-space-md">
      <ActivityHeader a={a} onOpenProfile={onOpenProfile} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={() => onOpen(a.id)}
        className="gap-space-md"
      >
        <View className="gap-1">
          <Text variant="headline-sm" numberOfLines={2}>
            {title}
          </Text>
          {a.description ? (
            <Text variant="body-md" className="text-ink-secondary" numberOfLines={3}>
              {a.description}
            </Text>
          ) : null}
        </View>

        {a.track || photo ? (
          <View className="h-40 flex-row gap-space-sm">
            {a.track ? <TrackThumb track={a.track} className="flex-1" /> : null}
            {photo ? (
              <Image
                source={{ uri: photo }}
                className="h-40 flex-1 rounded-md"
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : null}
          </View>
        ) : null}

        <View className="flex-row rounded-lg bg-surface-container-low py-space-sm">
          {activityStats(a).map((s) => (
            <View key={s.label} className="flex-1 items-center gap-0.5">
              <Text variant="label-caps" className="text-ink-secondary">
                {s.label}
              </Text>
              <Text variant="body-lg" className="font-bold text-brand" numberOfLines={1}>
                {s.value}
              </Text>
            </View>
          ))}
        </View>
      </Pressable>

      <View className="flex-row items-center gap-space-sm">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${a.kudosed ? tr.social.kudosed : tr.social.kudos}, ${a.kudos_count}`}
          accessibilityState={{ selected: a.kudosed }}
          onPress={() => onToggleKudos(a)}
          className={`min-h-[44px] flex-row items-center gap-space-sm rounded-full px-space-md ${
            a.kudosed ? 'bg-accent-soft' : 'bg-surface-container'
          }`}
        >
          <Text variant="body-md">👏</Text>
          <Text
            variant="body-md-medium"
            className={a.kudosed ? 'font-bold text-accent-deep' : 'text-ink-secondary'}
          >
            {formatCount(a.kudos_count)} {tr.social.kudos}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${tr.social.comments}, ${a.comment_count}`}
          onPress={() => onOpen(a.id)}
          className="min-h-[44px] flex-row items-center gap-space-sm rounded-full bg-surface-container px-space-md"
        >
          <MaterialIcons name="chat-bubble-outline" size={18} color={colors.ink.secondary} />
          <Text variant="body-md-medium" className="text-ink-secondary">
            {formatCount(a.comment_count)} {tr.social.comments}
          </Text>
        </Pressable>
        <View className="flex-1" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.social.share}
          onPress={() => onShare(a)}
          className="h-11 w-11 items-center justify-center rounded-full bg-brand-soft"
        >
          <MaterialIcons name="share" size={20} color={colors.brand.DEFAULT} />
        </Pressable>
      </View>

      {a.last_comment_body ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpen(a.id)}
          className="rounded-md bg-surface-container-low p-space-sm"
        >
          <Text variant="body-md" numberOfLines={2}>
            <Text variant="body-md" className="font-bold">
              {a.last_comment_author}{' '}
            </Text>
            {a.last_comment_body}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
});
