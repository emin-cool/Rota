import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { formatDistance, formatDuration } from '@/lib/geo';
import { countPois } from '@/lib/wizard';
import { routeColor } from '@/theme/routeColors';
import { colors, shadows } from '@/theme/tokens';
import type { PoiType, RouteOption } from '@/types/routes';

import { ElevationChart } from './ElevationChart';

type IconName = keyof typeof MaterialIcons.glyphMap;

const LABEL_ICON: Record<string, IconName> = {
  'En manzaralı': 'landscape',
  'En düz': 'trending-flat',
  'En kısa': 'bolt',
  'Her açıdan en iyi': 'star',
  Önerilen: 'star',
};

/** Sunucu birleşik etiket verebilir ("En manzaralı + En düz"); ikon ilk etiketten seçilir. */
const labelIcon = (label: string): IconName => LABEL_ICON[label.split(' + ')[0]!] ?? 'route';

const POI_ICON: Record<PoiType, IconName> = {
  water: 'water-drop',
  toilet: 'wc',
  cafe: 'local-cafe',
  pharmacy: 'local-pharmacy',
  market: 'local-grocery-store',
  hospital: 'local-hospital',
  transit: 'directions-transit',
};

type Props = {
  route: RouteOption;
  index: number;
  title: string;
  width: number;
  saved: boolean;
  saving: boolean;
  onStart: () => void;
  onSave: () => void;
  onShare: () => void;
};

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View className="flex-1">
      <Text variant="label-caps" className="text-ink-secondary">
        {label}
      </Text>
      <View className="flex-row items-baseline gap-1">
        <Text variant="headline-md">{value}</Text>
        <Text variant="body-md" className="text-ink-secondary">
          {unit}
        </Text>
      </View>
    </View>
  );
}

/** Sonuç kartı: etiket, skor, başlık, mesafe/süre/tırmanış, yükseklik profili, mola noktaları, butonlar. */
export function RouteResultCard({
  route,
  index,
  title,
  width,
  saved,
  saving,
  onStart,
  onSave,
  onShare,
}: Props) {
  const color = routeColor(index);
  const km = formatDistance(route.distanceM).split(' ');
  const mins = formatDuration(route.estDurationMin);
  const [minValue, minUnit] = mins.includes(' sa') ? [mins, ''] : [mins.replace(' dk', ''), 'dk'];
  const pois = countPois(route.pois);
  const poiChips = (Object.keys(pois) as PoiType[]).filter((k) => pois[k] > 0);

  return (
    <View
      className="gap-space-md rounded-xl bg-white p-space-md"
      style={[{ width }, shadows.level2]}
      accessibilityLabel={`${route.label}, ${title}`}
    >
      <View className="flex-row items-center justify-between">
        <View
          className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
          style={{ backgroundColor: color }}
        >
          <MaterialIcons name={labelIcon(route.label)} size={16} color={colors.white} />
          <Text variant="label-sm" className="font-bold text-white">
            {route.label}
          </Text>
        </View>
        <View className="flex-row items-center gap-1 rounded-full bg-surface-container px-3 py-1.5">
          <MaterialIcons name="eco" size={16} color={colors.brand.DEFAULT} />
          <Text variant="label-sm" className="font-bold">
            {route.scenicScore}
          </Text>
          <Text variant="label-caps" className="text-ink-secondary">
            {tr.results.score}
          </Text>
        </View>
      </View>

      <Text variant="headline-md" numberOfLines={2}>
        {title}
      </Text>

      <View className="flex-row gap-space-md rounded-lg bg-surface-container-low p-space-md">
        <Stat label={tr.results.distance} value={km[0] ?? ''} unit={km[1] ?? ''} />
        <Stat label={tr.results.duration} value={minValue} unit={minUnit} />
        <Stat label={tr.results.ascent} value={`+${route.elevationGainM}`} unit="m" />
      </View>

      <View className="gap-1 rounded-lg bg-surface-container-low px-space-md py-space-sm">
        <View className="flex-row items-center gap-1">
          <MaterialIcons name="show-chart" size={16} color={colors.ink.secondary} />
          <Text variant="label-sm" className="text-ink-secondary">
            {tr.results.elevation}
          </Text>
        </View>
        <ElevationChart profile={route.elevationProfile} color={color} />
      </View>

      <View className="min-h-[36px] flex-row flex-wrap items-center gap-space-sm">
        {poiChips.length > 0 ? (
          poiChips.map((k) => (
            <View
              key={k}
              className="flex-row items-center gap-1 rounded-full bg-surface-container px-3 py-1.5"
            >
              <MaterialIcons name={POI_ICON[k]} size={16} color={colors.brand.DEFAULT} />
              <Text variant="label-sm" className="font-bold">
                {tr.results.poi[k]} ({pois[k]})
              </Text>
            </View>
          ))
        ) : (
          <Text variant="label-sm" className="text-ink-muted">
            {tr.results.noPois}
          </Text>
        )}
      </View>

      <View className="flex-row items-center gap-space-sm">
        <Button
          title={tr.results.start}
          className="flex-1"
          leading={<MaterialIcons name="play-arrow" size={22} color={colors['on-primary']} />}
          onPress={onStart}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? tr.results.saved : tr.results.save}
          accessibilityState={{ selected: saved, busy: saving }}
          disabled={saving}
          onPress={onSave}
          className={`h-[52px] w-[52px] items-center justify-center rounded-full ${
            saved ? 'bg-brand' : 'bg-surface-container'
          } ${saving ? 'opacity-60' : ''}`}
        >
          <MaterialIcons
            name={saved ? 'bookmark' : 'bookmark-border'}
            size={24}
            color={saved ? colors.white : colors.brand.DEFAULT}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.results.share}
          onPress={onShare}
          className="h-[52px] w-[52px] items-center justify-center rounded-full bg-surface-container"
        >
          <MaterialIcons name="share" size={22} color={colors.brand.DEFAULT} />
        </Pressable>
      </View>
    </View>
  );
}
