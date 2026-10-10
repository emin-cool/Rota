import { forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { tr } from '@/i18n/tr';

import type { HomeMapHandle, HomeMapProps } from './homeMapTypes';

/** @rnmapbox/maps web'de çalışmaz; tarayıcı önizlemesinde yer tutucu gösterilir. */
export const HomeMap = forwardRef<HomeMapHandle, HomeMapProps>(function HomeMap({ routes }, ref) {
  useImperativeHandle(ref, () => ({ recenter: () => {}, resetNorth: () => {} }), []);
  return (
    <View className="flex-1 items-center justify-center bg-surface-container-low px-margin">
      <Text variant="body-md" className="text-center text-ink-secondary">
        {tr.map.webPlaceholder} ({routes.length})
      </Text>
    </View>
  );
});
