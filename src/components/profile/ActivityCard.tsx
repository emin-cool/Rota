import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';

import { ACTIVITY_ICON, ACTIVITY_SOFT_BG } from '@/components/route/ExploreCard';
import { Card, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { formatDuration, formatDistance } from '@/lib/geo';
import { formatPace } from '@/lib/pace';
import { formatActivityWhen } from '@/lib/profileStats';
import { colors } from '@/theme/tokens';
import type { ActivityListItem } from '@/types/database';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center gap-0.5">
      <Text variant="label-sm" className="text-ink-secondary">
        {label}
      </Text>
      <Text variant="headline-sm">{value}</Text>
    </View>
  );
}

/** Profil "Aktivitelerim" satırı: tarih, başlık, mesafe / süre / tempo ya da yükseklik. */
export function ActivityCard({ item }: { item: ActivityListItem }) {
  const hasPace = item.activity_type !== 'bike' && item.avg_pace_sec_per_km !== null;
  return (
    <Card elevation="raised" className="gap-space-md p-space-md">
      <View className="flex-row items-center gap-space-md">
        <View
          className={`h-11 w-11 items-center justify-center rounded-full ${ACTIVITY_SOFT_BG[item.activity_type]}`}
        >
          <MaterialIcons
            name={ACTIVITY_ICON[item.activity_type]}
            size={22}
            color={colors.activity[item.activity_type]}
          />
        </View>
        <View className="flex-1">
          <Text variant="label-caps" className="text-ink-secondary">
            {formatActivityWhen(item.started_at)}
          </Text>
          <Text variant="headline-sm" numberOfLines={2}>
            {item.title ?? tr.profile.activityName[item.activity_type]}
          </Text>
        </View>
      </View>
      <View className="flex-row rounded-lg bg-surface-container-low py-space-sm">
        <Metric label={tr.profile.distance} value={formatDistance(item.distance_m)} />
        <Metric label={tr.profile.duration} value={formatDuration(item.duration_sec / 60)} />
        {hasPace ? (
          <Metric label={tr.profile.pace} value={`${formatPace(item.avg_pace_sec_per_km!)} /km`} />
        ) : (
          <Metric label={tr.profile.ascent} value={`+${item.elevation_gain_m} m`} />
        )}
      </View>
    </Card>
  );
}
