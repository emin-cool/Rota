import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/theme/tokens';

type Props = {
  /** 0–1: halkanın dolu kısmı. */
  fraction: number;
  size?: number;
  strokeWidth?: number;
  children?: ReactNode;
};

/** Süre/mesafe halkası: dolu yay (yeşil) ve ucunda turuncu işaretçi (Stitch "Hedef süre"). */
export function DurationRing({ fraction, size = 232, strokeWidth = 18, children }: Props) {
  const f = Math.min(1, Math.max(0.001, fraction));
  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const angle = f * 2 * Math.PI - Math.PI / 2;
  const knobX = c + r * Math.cos(angle);
  const knobY = c + r * Math.sin(angle);

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={colors['surface-container-high']}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={colors.brand.DEFAULT}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference * f} ${circumference}`}
          fill="none"
          rotation={-90}
          origin={`${c}, ${c}`}
        />
        <Circle
          cx={knobX}
          cy={knobY}
          r={strokeWidth / 2 + 2}
          fill={colors.accent.DEFAULT}
          stroke="#ffffff"
          strokeWidth={3}
        />
      </Svg>
      {children}
    </View>
  );
}
