import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { projectTrack } from '@/lib/activitySummary';
import type { LngLat } from '@/lib/geo';
import { colors } from '@/theme/tokens';

/**
 * Akış kartındaki mini iz: harita zemini yok, yol `react-native-svg` ile çizilir (hafif, çevrimdışı, GL yok).
 * İz sunucudan gizlilik bölgesine göre kırpılmış gelir.
 */
export function TrackThumb({
  track,
  className = '',
}: {
  track: { coordinates: [number, number][] } | null;
  className?: string;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const pts = useMemo(
    () =>
      track && size.w > 0 ? projectTrack(track.coordinates as LngLat[], size.w, size.h, 18) : [],
    [track, size],
  );
  const line = pts.map((p) => `${p[0]},${p[1]}`).join(' ');
  const first = pts[0];
  const last = pts[pts.length - 1];

  return (
    <View
      className={`overflow-hidden rounded-md bg-surface-container-low ${className}`}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {pts.length > 1 ? (
        <Svg width={size.w} height={size.h}>
          <Polyline
            points={line}
            fill="none"
            stroke={colors.white}
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Polyline
            points={line}
            fill="none"
            stroke={colors.brand.DEFAULT}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle
            cx={first![0]}
            cy={first![1]}
            r={5}
            fill={colors.brand.DEFAULT}
            stroke={colors.white}
            strokeWidth={2}
          />
          <Circle
            cx={last![0]}
            cy={last![1]}
            r={5}
            fill={colors.accent.deep}
            stroke={colors.white}
            strokeWidth={2}
          />
        </Svg>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text variant="label-sm" className="text-ink-secondary">
            {tr.social.gpsTrack}
          </Text>
        </View>
      )}
    </View>
  );
}
