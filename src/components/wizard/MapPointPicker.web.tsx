import { useEffect } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { tr } from '@/i18n/tr';

import type { PointPickerProps } from './pointPickerTypes';

/** @rnmapbox/maps web'de çalışmaz: tarayıcı önizlemesinde başlangıç merkezi seçili sayılır. */
export function MapPointPicker({ initialCenter, onCenterChange }: PointPickerProps) {
  useEffect(() => {
    onCenterChange(initialCenter);
    // yalnızca ilk açılışta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View className="flex-1 items-center justify-center bg-surface-container-low px-margin">
      <Text variant="body-md" className="text-center text-ink-secondary">
        {tr.wizard.step2.mapUnavailable}
      </Text>
    </View>
  );
}
