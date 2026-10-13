import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { tr } from '@/i18n/tr';
import { buildElevationPaths, type ElevationPoint } from '@/lib/elevation';

type Props = {
  profile: ElevationPoint[];
  color: string;
  height?: number;
};

/** Mini yükseklik profili: üstten renge solan dolgu + 2 px çizgi (Stitch "Elevation Cross-Section"). */
export function ElevationChart({ profile, color, height = 56 }: Props) {
  const [width, setWidth] = useState(0);
  const paths = buildElevationPaths(profile, width, height);
  // Gradyan kimliği, aynı ekranda farklı renkli grafikler çakışmasın diye renge bağlı.
  const gradientId = `elev-${color.replace('#', '')}`;

  return (
    <View
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={{ height }}
      accessibilityRole="image"
      accessibilityLabel={tr.common.elevationProfile}
    >
      {paths ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.28} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={paths.area} fill={`url(#${gradientId})`} />
          <Path d={paths.line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}
