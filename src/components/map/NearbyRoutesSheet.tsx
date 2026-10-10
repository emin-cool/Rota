import { MaterialIcons } from '@expo/vector-icons';
import { FlatList, View } from 'react-native';

import { RouteCard } from '@/components/route/RouteCard';
import { Button, HeadlineMd, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { colors } from '@/theme/tokens';
import type { NearbyRoute } from '@/types/database';

import { LocationNotice } from './LocationNotice';

type Props = {
  routes: NearbyRoute[] | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onRoutePress: (routeId: string) => void;
  /** Konum izni yoksa liste üstünde gösterilecek bilgilendirme. */
  locationDenied: boolean;
  onRequestLocation: () => void;
  /** İzin penceresi tekrar açılamıyorsa buton "Ayarları aç" olur. */
  canAskLocationAgain: boolean;
};

function SkeletonCard() {
  return <View className="h-[200px] w-[280px] rounded-lg bg-surface-container" />;
}

/** Alt sheet içeriği: başlık + yükleniyor / hata / boş / rota listesi durumları. */
export function NearbyRoutesSheet({
  routes,
  loading,
  error,
  onRetry,
  onRoutePress,
  locationDenied,
  onRequestLocation,
  canAskLocationAgain,
}: Props) {
  return (
    <View className="gap-space-md pb-space-lg pt-space-sm">
      <View className="flex-row items-center justify-between px-margin">
        <HeadlineMd className="flex-1 text-headline-sm">{tr.map.nearbyTitle}</HeadlineMd>
        {routes && routes.length > 0 ? (
          <Text variant="body-md-medium" className="text-brand">
            {tr.map.seeAll(routes.length)}
          </Text>
        ) : null}
      </View>

      {locationDenied ? (
        <LocationNotice onAllow={onRequestLocation} canAskAgain={canAskLocationAgain} />
      ) : null}

      {loading ? (
        <View
          accessibilityLabel={tr.common.loading}
          className="flex-row gap-space-md overflow-hidden px-margin"
        >
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : error ? (
        <View className="items-center gap-space-sm px-margin py-space-md">
          <MaterialIcons name="cloud-off" size={32} color={colors.ink.muted} />
          <Text variant="headline-sm">{tr.map.errorTitle}</Text>
          <Text variant="body-md" className="text-center text-ink-secondary">
            {tr.map.errorBody}
          </Text>
          <Button title={tr.common.retry} variant="secondary" onPress={onRetry} />
        </View>
      ) : routes && routes.length === 0 ? (
        <View className="items-center gap-space-sm px-margin py-space-md">
          <MaterialIcons name="route" size={32} color={colors.ink.muted} />
          <Text variant="headline-sm">{tr.map.emptyTitle}</Text>
          <Text variant="body-md" className="text-center text-ink-secondary">
            {tr.map.emptyBody}
          </Text>
        </View>
      ) : (
        <FlatList
          horizontal
          data={routes}
          keyExtractor={(r) => r.id}
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-space-md px-margin pb-space-sm"
          renderItem={({ item }) => (
            <RouteCard route={item} onPress={() => onRoutePress(item.id)} />
          )}
        />
      )}
    </View>
  );
}
