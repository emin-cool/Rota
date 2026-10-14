import { View } from 'react-native';

import { Text } from '@/components/ui';
import { tr } from '@/i18n/tr';

import type { LiveMiniMapProps } from './liveMapTypes';

/** @rnmapbox/maps web'de çalışmaz: tarayıcı önizlemesinde yer tutucu. */
export function LiveMiniMap({ track }: LiveMiniMapProps) {
  return (
    <View className="flex-1 items-center justify-center bg-live-card-deep px-margin">
      <Text variant="body-md" className="text-center text-primary-fixed-dim">
        {tr.wizard.step2.mapUnavailable} ({track.length})
      </Text>
    </View>
  );
}
