import { View } from 'react-native';

import { Text } from '@/components/ui';
import { formatDistance } from '@/lib/geo';
import { barRatio, WEEKDAYS_TR } from '@/lib/profileStats';
import { colors } from '@/theme/tokens';

const BAR_AREA_H = 120;

/** Bu haftanın günlük mesafe çubukları (Pzt…Paz); en uzun gün turuncu ve üstünde mesafe etiketi. */
export function WeeklyChart({
  valuesM,
  peakIndex,
}: {
  valuesM: number[];
  peakIndex: number | null;
}) {
  const max = Math.max(...valuesM, 0);
  return (
    <View
      className="flex-row items-end justify-between gap-space-sm"
      accessibilityRole="image"
      accessibilityLabel={valuesM
        .map((v, i) => `${WEEKDAYS_TR[i]}: ${formatDistance(v)}`)
        .join(', ')}
    >
      {valuesM.map((v, i) => {
        const isPeak = i === peakIndex;
        const h = v > 0 ? Math.max(8, Math.round(barRatio(v, max) * BAR_AREA_H)) : 4;
        return (
          <View key={WEEKDAYS_TR[i]} className="flex-1 items-center gap-space-xs">
            <View style={{ height: BAR_AREA_H }} className="w-full items-center justify-end">
              {isPeak ? (
                <View className="mb-1 rounded-md bg-accent px-1.5 py-0.5">
                  <Text variant="label-sm" className="font-bold text-white">
                    {formatDistance(v)}
                  </Text>
                </View>
              ) : null}
              <View
                className="w-full rounded-md"
                style={{
                  height: h,
                  backgroundColor: isPeak
                    ? colors.accent.DEFAULT
                    : v > 0
                      ? colors['primary-fixed']
                      : colors['surface-container-high'],
                }}
              />
            </View>
            <Text
              variant="label-sm"
              className={isPeak ? 'font-bold text-accent-deep' : 'text-ink-secondary'}
            >
              {WEEKDAYS_TR[i]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
