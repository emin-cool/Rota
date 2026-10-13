import { useEffect, useState } from 'react';
import { Animated, type ViewStyle } from 'react-native';

/** Yükleme iskeleti: yumuşakça sönüp yanan gri blok. Boyutları `className` ile ver (örn. `h-6 w-40`). */
export function Skeleton({ className = '', style }: { className?: string; style?: ViewStyle }) {
  const [opacity] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={`rounded-md bg-surface-container-high ${className}`}
      style={[{ opacity }, style]}
    />
  );
}
