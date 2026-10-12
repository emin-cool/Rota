import { View } from 'react-native';

import { Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import type { ExploreRoute } from '@/types/database';

/** @rnmapbox/maps web'de çalışmaz; tarayıcı önizlemesinde yer tutucu. */
export function ExploreMap(_props: {
  routes: ExploreRoute[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View className="flex-1 items-center justify-center bg-surface-container-low px-margin">
      <Text variant="body-md" className="text-center text-ink-secondary">
        {tr.explore.mapUnavailable}
      </Text>
    </View>
  );
}
