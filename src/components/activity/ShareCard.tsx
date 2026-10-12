import { forwardRef, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { projectTrack } from '@/lib/activitySummary';
import type { LngLat } from '@/lib/geo';
import { colors } from '@/theme/tokens';

export const SHARE_CARD_W = 360;
export const SHARE_CARD_H = 450;
const MAP_H = 270;

type Stat = { label: string; value: string };

type Props = {
  title: string;
  dateText: string;
  track: LngLat[];
  stats: Stat[];
};

/**
 * Paylaşım görseli. Harita zemini yok: yol react-native-svg ile çizilir, böylece Mapbox'ın GL
 * yüzeyinin ekran görüntüsünde siyah çıkma sorunundan ve internetten bağımsızdır.
 * Ekran dışında render edilip react-native-view-shot ile PNG'ye çevrilir.
 */
export const ShareCard = forwardRef<View, Props>(function ShareCard(
  { title, dateText, track, stats },
  ref,
) {
  const pts = useMemo(() => projectTrack(track, SHARE_CARD_W, MAP_H, 36), [track]);
  const first = pts[0];
  const last = pts[pts.length - 1];

  return (
    <View
      ref={ref}
      collapsable={false}
      style={{ width: SHARE_CARD_W, height: SHARE_CARD_H, backgroundColor: colors.canvas }}
    >
      <View style={{ height: MAP_H, backgroundColor: colors['surface-container-low'] }}>
        <Svg width={SHARE_CARD_W} height={MAP_H}>
          {pts.length > 1 ? (
            <>
              <Polyline
                points={pts.map((p) => `${p[0]},${p[1]}`).join(' ')}
                fill="none"
                stroke="#ffffff"
                strokeWidth={9}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Polyline
                points={pts.map((p) => `${p[0]},${p[1]}`).join(' ')}
                fill="none"
                stroke={colors.brand.DEFAULT}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Circle
                cx={first![0]}
                cy={first![1]}
                r={7}
                fill={colors.brand.DEFAULT}
                stroke="#fff"
                strokeWidth={3}
              />
              <Circle
                cx={last![0]}
                cy={last![1]}
                r={7}
                fill={colors.accent.DEFAULT}
                stroke="#fff"
                strokeWidth={3}
              />
            </>
          ) : null}
        </Svg>
      </View>
      <View style={{ padding: 20, gap: 4 }}>
        <Text variant="headline-md" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="body-md" className="text-ink-secondary">
          {dateText}
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 12, justifyContent: 'space-between' }}>
          {stats.map((s) => (
            <View key={s.label}>
              <Text variant="label-caps" className="text-ink-muted">
                {s.label}
              </Text>
              <Text variant="headline-sm" className="text-brand">
                {s.value}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ position: 'absolute', right: 16, bottom: 12 }}>
        <Text variant="label-caps" className="text-brand">
          {tr.summary.shareCardBrand}
        </Text>
      </View>
    </View>
  );
});
