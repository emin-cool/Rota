import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityTrackMap } from '@/components/activity/ActivityTrackMap';
import { ACTIVITY_ICON, ACTIVITY_SOFT_BG } from '@/components/route/ExploreCard';
import { ElevationChart } from '@/components/route/ElevationChart';
import { RatingSummaryCard, ReviewItem } from '@/components/route/ReviewParts';
import { Avatar, Button, Card, HeadlineMd, Skeleton, Text } from '@/components/ui';
import {
  usePois,
  useRatingSummary,
  useRouteDetail,
  useRouteReviews,
  useToggleSaved,
} from '@/hooks/useRouteQueries';
import { useStartActivity } from '@/hooks/useStartActivity';
import { tr } from '@/i18n/tr';
import { estimateCalories } from '@/lib/activitySummary';
import { directionsUrl } from '@/lib/explore';
import { formatDuration, type LngLat } from '@/lib/geo';
import { colors } from '@/theme/tokens';
import type { PoiType } from '@/types/database';

const POI_ICON: Record<PoiType, keyof typeof MaterialIcons.glyphMap> = {
  water: 'water-drop',
  toilet: 'wc',
  cafe: 'local-cafe',
  bench: 'chair',
  transit: 'directions-bus',
};

function StatTile({
  icon,
  value,
  label,
  highlight = false,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  value: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <View
      className={`min-h-[84px] flex-1 items-center justify-center gap-1 rounded-lg p-space-sm ${
        highlight ? 'bg-brand-soft' : 'bg-surface-container-low'
      }`}
    >
      <MaterialIcons name={icon} size={20} color={colors.brand.DEFAULT} />
      <Text variant="headline-sm" numberOfLines={1}>
        {value}
      </Text>
      <Text variant="label-sm" className="text-ink-secondary">
        {label}
      </Text>
    </View>
  );
}

function SectionError() {
  return (
    <Text variant="body-md" className="text-ink-secondary">
      {tr.detail.sectionError}
    </Text>
  );
}

export default function RouteDetailScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const galleryWidth = width - 32;

  const detail = useRouteDetail(id);
  const summary = useRatingSummary(id);
  const pois = usePois(id);
  const reviews = useRouteReviews(id);
  const toggle = useToggleSaved();
  const { start, starting } = useStartActivity();
  const [photoIndex, setPhotoIndex] = useState(0);

  const route = detail.data;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (detail.isPending) {
    return (
      <View
        className="flex-1 gap-space-md bg-canvas px-margin"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
      </View>
    );
  }

  if (detail.isError || !route) {
    return (
      <View
        className="flex-1 items-center justify-center gap-space-md bg-canvas px-margin"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <MaterialIcons name="cloud-off" size={40} color={colors.ink.muted} />
        <HeadlineMd className="text-center">
          {detail.isError ? tr.detail.errorTitle : tr.detail.notFound}
        </HeadlineMd>
        {detail.isError ? (
          <Button
            title={tr.common.retry}
            variant="secondary"
            onPress={() => void detail.refetch()}
          />
        ) : null}
        <Button title={tr.detail.back} variant="ghost" onPress={goBack} />
      </View>
    );
  }

  const coords = route.geojson.coordinates as LngLat[];
  const kcal = estimateCalories(route.activity_type, route.distance_m);
  const profile = route.elevation_profile;
  const zs = profile?.map((p) => p.z) ?? [];
  const reviewList = reviews.data?.pages.flat() ?? [];
  const kmText = (route.distance_m / 1000).toFixed(1).replace('.', ',');

  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / galleryWidth));

  const openDirections = () =>
    void Linking.openURL(
      directionsUrl(route.start_lat, route.start_lng, Platform.OS === 'ios' ? 'ios' : 'android'),
    );

  const startRoute = () =>
    void start({
      activityType: route.activity_type,
      route: coords,
      routeTitle: route.title,
      routeId: route.id,
    });

  const share = () => void Share.share({ message: tr.detail.shareMessage(route.title, kmText) });

  return (
    <View className="flex-1 bg-canvas">
      {/* Üst çubuk */}
      <View
        className="flex-row items-center justify-between px-space-sm pb-space-sm"
        style={{ paddingTop: insets.top + 4 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.common.back}
          onPress={goBack}
          hitSlop={8}
          className="h-11 w-11 items-center justify-center"
        >
          <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.ink.DEFAULT} />
        </Pressable>
        <HeadlineMd>{tr.detail.title}</HeadlineMd>
        <View className="flex-row">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={route.saved ? tr.detail.unsave : tr.detail.save}
            accessibilityState={{ selected: route.saved }}
            onPress={() => toggle.mutate({ routeId: route.id, saved: !route.saved })}
            hitSlop={4}
            className="h-11 w-11 items-center justify-center"
          >
            <MaterialIcons
              name={route.saved ? 'bookmark' : 'bookmark-border'}
              size={24}
              color={route.saved ? colors.brand.DEFAULT : colors.ink.DEFAULT}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr.detail.share}
            onPress={share}
            hitSlop={4}
            className="h-11 w-11 items-center justify-center"
          >
            <MaterialIcons name="ios-share" size={22} color={colors.ink.DEFAULT} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerClassName="gap-space-lg px-margin pb-space-xl">
        {/* Galeri */}
        <View className="overflow-hidden rounded-xl">
          {route.photos.length > 0 ? (
            <View>
              <FlatList
                data={route.photos}
                keyExtractor={(u) => u}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onGalleryScroll}
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: item }}
                    style={{ width: galleryWidth, height: 220 }}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                )}
              />
              <View className="absolute bottom-3 right-3 flex-row items-center gap-1 rounded-full bg-black/55 px-2.5 py-1">
                <MaterialIcons name="photo-camera" size={14} color="#fff" />
                <Text variant="label-sm" className="font-bold text-white">
                  {tr.detail.photoCount(photoIndex + 1, route.photos.length)}
                </Text>
              </View>
            </View>
          ) : (
            <View
              className={`h-[200px] items-center justify-center ${ACTIVITY_SOFT_BG[route.activity_type]}`}
            >
              <MaterialIcons
                name={ACTIVITY_ICON[route.activity_type]}
                size={64}
                color={colors.activity[route.activity_type]}
              />
            </View>
          )}
          <View className="absolute left-3 top-3 flex-row gap-space-sm">
            {route.district ? (
              <View className="rounded-full bg-white/90 px-3 py-1.5">
                <Text variant="label-sm" className="font-bold">
                  {route.district}
                </Text>
              </View>
            ) : null}
            {route.is_featured ? (
              <View className="rounded-full bg-accent px-3 py-1.5">
                <Text variant="label-sm" className="font-bold text-white">
                  {tr.detail.popularBadge}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Başlık + oluşturan */}
        <View className="gap-space-md">
          <View className="flex-row items-start justify-between gap-space-sm">
            <Text variant="headline-lg" className="flex-1">
              {route.title}
            </Text>
            <View className="rounded-full bg-accent-soft px-3 py-1.5">
              <Text variant="label-sm" className="font-bold text-accent-deep">
                {tr.detail.kcal(kcal)}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-space-md">
            <Avatar name={route.creator_name} uri={route.creator_avatar} size={40} />
            <Text variant="body-md" className="font-bold">
              {route.creator_name ?? tr.detail.noCreator}
            </Text>
          </View>
          {route.description ? (
            <Text variant="body-md" className="text-ink-secondary">
              {route.description}
            </Text>
          ) : null}
        </View>

        {/* İstatistikler */}
        <View className="flex-row gap-space-sm">
          <StatTile icon="straighten" value={kmText} label={`km ${tr.detail.distance}`} />
          <StatTile
            icon="schedule"
            value={route.est_duration_min ? formatDuration(route.est_duration_min) : '—'}
            label={tr.detail.time}
          />
          <StatTile
            icon="trending-up"
            value={`+${route.elevation_gain_m}`}
            label={`m ${tr.detail.ascent}`}
          />
          <StatTile
            icon="sentiment-satisfied"
            value={route.difficulty ? tr.detail.difficulty[route.difficulty] : '—'}
            label={tr.detail.level}
            highlight
          />
        </View>

        {/* Harita önizleme */}
        <View className="h-[220px] overflow-hidden rounded-lg border border-hairline">
          <ActivityTrackMap track={coords} />
        </View>

        {/* Yükseklik profili: yalnızca verisi olan rotalarda */}
        {profile && profile.length >= 2 ? (
          <Card className="gap-space-sm p-space-md">
            <View className="flex-row items-center justify-between">
              <Text variant="headline-sm">{tr.detail.elevationTitle}</Text>
              <Text variant="label-sm" className="text-ink-secondary">
                {tr.detail.elevationMin(Math.round(Math.min(...zs)))} ·{' '}
                {tr.detail.elevationMax(Math.round(Math.max(...zs)))}
              </Text>
            </View>
            <ElevationChart profile={profile} color={colors.brand.mid} height={90} />
          </Card>
        ) : null}

        {/* Rota boyunca */}
        <View className="gap-space-md">
          <View className="flex-row items-center justify-between">
            <HeadlineMd>{tr.detail.poisTitle}</HeadlineMd>
            {pois.data && pois.data.length > 0 ? (
              <View className="rounded-full bg-brand-soft px-2.5 py-1">
                <Text variant="label-caps" className="text-brand">
                  {tr.detail.poisCategories(pois.data.length)}
                </Text>
              </View>
            ) : null}
          </View>
          {pois.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : pois.isError ? (
            <SectionError />
          ) : pois.data.length === 0 ? (
            <Text variant="body-md" className="text-ink-secondary">
              {tr.detail.poisEmpty}
            </Text>
          ) : (
            pois.data.map((p) => (
              <Card key={p.poi_type} className="flex-row items-center gap-space-md p-space-md">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-soft">
                  <MaterialIcons
                    name={POI_ICON[p.poi_type]}
                    size={22}
                    color={colors.brand.DEFAULT}
                  />
                </View>
                <View className="flex-1">
                  <Text variant="body-md" className="font-bold">
                    {tr.detail.poiLabel[p.poi_type]}
                  </Text>
                  {p.sample_name ? (
                    <Text variant="label-sm" className="text-ink-secondary" numberOfLines={1}>
                      {p.sample_name}
                    </Text>
                  ) : null}
                </View>
                <View className="rounded-full bg-surface-container px-2.5 py-1">
                  <Text variant="label-sm" className="font-bold">
                    {tr.detail.poiCount(p.n)}
                  </Text>
                </View>
              </Card>
            ))
          )}
        </View>

        {/* Değerlendirmeler */}
        <View className="gap-space-md">
          <View className="flex-row items-center justify-between">
            <HeadlineMd>{tr.detail.reviewsTitle}</HeadlineMd>
            {summary.data ? (
              <Text variant="label-sm" className="text-ink-secondary">
                {tr.detail.reviewsCount(summary.data.count)}
              </Text>
            ) : null}
          </View>
          {summary.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : summary.isError ? (
            <SectionError />
          ) : summary.data.count === 0 ? (
            <Text variant="body-md" className="text-ink-secondary">
              {tr.detail.noReviews}
            </Text>
          ) : (
            <RatingSummaryCard summary={summary.data} />
          )}

          {reviews.isPending ? (
            <Skeleton className="h-28 w-full" />
          ) : reviews.isError ? (
            <SectionError />
          ) : (
            reviewList.map((r) => <ReviewItem key={r.id} review={r} />)
          )}

          {reviews.hasNextPage ? (
            <Button
              title={tr.detail.moreReviews}
              variant="ghost"
              loading={reviews.isFetchingNextPage}
              onPress={() => void reviews.fetchNextPage()}
            />
          ) : null}
          <Button
            title={tr.detail.writeReview}
            variant="secondary"
            leading={<MaterialIcons name="rate-review" size={20} color={colors.brand.DEFAULT} />}
            onPress={() =>
              router.push({ pathname: '/route/[id]/review', params: { id: route.id } })
            }
          />
        </View>
      </ScrollView>

      {/* Alt çubuk */}
      <View
        className="flex-row gap-space-md border-t border-hairline bg-canvas px-margin pt-space-md"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Button
          title={tr.detail.directions}
          variant="secondary"
          leading={<MaterialIcons name="directions" size={20} color={colors.brand.DEFAULT} />}
          onPress={openDirections}
          className="flex-1"
        />
        <Button
          title={tr.detail.start}
          loading={starting}
          leading={<MaterialIcons name="navigation" size={20} color="#fff" />}
          onPress={startRoute}
          className="flex-[1.6]"
        />
      </View>
    </View>
  );
}
