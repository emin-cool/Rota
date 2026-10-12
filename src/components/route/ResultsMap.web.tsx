import { View } from 'react-native';

import { Text } from '@/components/ui';
import { tr } from '@/i18n/tr';

import type { ResultsMapProps } from './resultsMapTypes';

/** @rnmapbox/maps web'de çalışmaz; tarayıcı önizlemesinde yer tutucu. */
export function ResultsMap({ routes }: ResultsMapProps) {
  return (
    <View className="flex-1 items-center justify-center bg-surface-container-low px-margin">
      <Text variant="body-md" className="text-center text-ink-secondary">
        {tr.wizard.step2.mapUnavailable} ({routes.length})
      </Text>
    </View>
  );
}
