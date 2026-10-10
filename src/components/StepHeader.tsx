import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { colors } from '@/theme/tokens';

/** "ADIM 1 / 2" rozeti + ilerleme çubuğu (onboarding adımları). */
export function StepHeader({
  step,
  total,
  label,
  showBack = false,
}: {
  step: number;
  total: number;
  label: string;
  showBack?: boolean;
}) {
  return (
    <View className="gap-space-sm px-margin pt-space-sm">
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.common.back}
          onPress={() => router.back()}
          className="-ml-3 h-11 w-11 items-center justify-center"
        >
          <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.ink.DEFAULT} />
        </Pressable>
      ) : null}
      <View className="flex-row items-center gap-space-sm">
        <View className="rounded-full bg-primary-fixed px-3 py-1">
          <Text variant="label-caps" className="text-on-primary-fixed-variant">
            {tr.onboarding.step(step, total)}
          </Text>
        </View>
        <Text variant="label-sm" className="flex-1 text-ink-secondary">
          {label}
        </Text>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: total, now: step }}
          className="w-24 flex-row gap-1"
        >
          {Array.from({ length: total }, (_, i) => (
            <View
              key={i}
              className={`h-1 flex-1 rounded-full ${i < step ? 'bg-brand' : 'bg-surface-container-high'}`}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
