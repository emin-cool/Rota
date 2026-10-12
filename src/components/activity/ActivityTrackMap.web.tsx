import { View } from 'react-native';

import { Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import type { LngLat } from '@/lib/geo';

/** @rnmapbox/maps web'de çalışmaz; tarayıcı önizlemesinde yer tutucu. */
export function ActivityTrackMap(_props: { track: LngLat[] }) {
  return (
    <View className="flex-1 items-center justify-center bg-surface-container-low px-margin">
      <Text variant="body-md" className="text-center text-ink-secondary">
        {tr.summary.mapUnavailable}
      </Text>
    </View>
  );
}
