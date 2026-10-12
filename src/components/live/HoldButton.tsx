import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  /** Basılı tutma süresi (ms). */
  duration?: number;
  onConfirm: () => void;
  accessibilityLabel: string;
  className?: string;
  fillClassName?: string;
  children: ReactNode;
};

/**
 * Yanlışlıkla dokunmayı önlemek için "basılı tut" butonu: basılı tutuldukça dolar, süre dolunca
 * `onConfirm` çalışır, erken bırakılırsa geri sarılır.
 */
export function HoldButton({
  duration = 1500,
  onConfirm,
  accessibilityLabel,
  className = '',
  fillClassName = 'bg-live-alert/40',
  children,
}: Props) {
  const progress = useSharedValue(0);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        progress.value = withTiming(1, { duration, easing: Easing.linear }, (finished) => {
          if (finished) runOnJS(onConfirm)();
        });
      }}
      onPressOut={() => {
        cancelAnimation(progress);
        progress.value = withTiming(0, { duration: 200 });
      }}
      className={`overflow-hidden ${className}`}
    >
      <Animated.View className={`absolute inset-y-0 left-0 ${fillClassName}`} style={fillStyle} />
      <View className="flex-1 items-center justify-center">{children}</View>
    </Pressable>
  );
}
