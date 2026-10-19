import { MaterialIcons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { conditionFor, formatTemp, type CurrentWeather } from '@/lib/weather';
import { colors, shadows } from '@/theme/tokens';

/** Harita üstünde küçük hava çipi ("18° · Parçalı bulutlu"); dokununca ayrıntı sayfası açılır. */
export function WeatherChip({
  current,
  onPress,
}: {
  current: CurrentWeather;
  onPress: () => void;
}) {
  const condition = conditionFor(current.code, current.isDay);
  const temp = formatTemp(current.tempC);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr.weather.chipLabel(temp, condition.label)}
      onPress={onPress}
      className="min-h-[44px] flex-row items-center gap-2 self-start rounded-full border border-hairline bg-white px-3 active:bg-surface-container"
      style={shadows.level1}
    >
      <MaterialIcons name={condition.icon} size={20} color={colors.accent.deep} />
      <Text variant="body-md-medium">{temp}</Text>
      <Text variant="label-sm" className="text-ink-secondary">
        {condition.label}
      </Text>
    </Pressable>
  );
}
