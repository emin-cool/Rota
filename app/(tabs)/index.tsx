import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityFilterChips, type ActivityFilter } from '@/components/map/ActivityFilterChips';
import { HomeMap } from '@/components/map/HomeMap';
import type { HomeMapHandle } from '@/components/map/homeMapTypes';
import { MapControls } from '@/components/map/MapControls';
import { NearbyRoutesSheet } from '@/components/map/NearbyRoutesSheet';
import { SearchBar } from '@/components/map/SearchBar';
import { WeatherChip } from '@/components/weather/WeatherChip';
import { WeatherSheet } from '@/components/weather/WeatherSheet';
import { BottomSheet, Button, Text } from '@/components/ui';
import { useNearbyRoutes } from '@/hooks/useNearbyRoutes';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useWeather } from '@/hooks/useWeather';
import { tr } from '@/i18n/tr';
import { DEFAULT_CENTER, FALLBACK_RADIUS_M, NEARBY_RADIUS_M } from '@/lib/mapConfig';
import { useCourseSessionStore } from '@/stores/courseSessionStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useWizardStore } from '@/stores/wizardStore';
import { shadows } from '@/theme/tokens';

// Sheet noktaları: 110 pt peek, ekranın %38'i (açılış), %90.
const SNAP_POINTS = [110, '38%', '90%'];
const FAB_HEIGHT = 52;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const profile = useSessionStore((s) => s.profile);
  const mapRef = useRef<HomeMapHandle>(null);

  const [activity, setActivity] = useState<ActivityFilter>(null);
  const [heading, setHeading] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const sheetTop = useSharedValue(0);

  const location = useUserLocation();
  const center = location.coords ?? DEFAULT_CENTER;
  const weather = useWeather(location.coords, location.status !== 'loading');
  const [weatherOpen, setWeatherOpen] = useState(false);
  const routesQuery = useNearbyRoutes({
    center,
    radiusM: location.coords ? NEARBY_RADIUS_M : FALLBACK_RADIUS_M,
    activity,
    enabled: location.status !== 'loading',
  });

  // Ayarlardan izin verip dönünce konumu yeniden oku.
  const { status, refresh } = location;
  useEffect(() => {
    if (status !== 'denied') return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => sub.remove();
  }, [status, refresh]);

  // "Rota Oluştur" butonu sheet'in üst kenarında yüzer; sheet çok yükselince kaybolur.
  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTop.value - FAB_HEIGHT - 16 }],
    opacity:
      containerHeight > 0
        ? interpolate(
            sheetTop.value,
            [containerHeight * 0.45, containerHeight * 0.62],
            [0, 1],
            'clamp',
          )
        : 0,
  }));

  const startWizard = () => {
    // Her yeni sihirbaz, profil tercihlerinden (aktivite, tempo) temiz başlar.
    useWizardStore.getState().reset(profile);
    useCourseSessionStore.getState().clear();
    router.push('/route-wizard/step-1');
  };

  const openRoute = (id: string) => router.push({ pathname: '/route/[id]', params: { id } });
  const initial = (profile?.display_name ?? profile?.username ?? '?').charAt(0).toUpperCase();

  return (
    <View
      className="flex-1 bg-canvas"
      onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
    >
      <HomeMap
        ref={mapRef}
        routes={routesQuery.data ?? []}
        userCoords={location.coords}
        locationGranted={location.status === 'granted'}
        onRoutePress={openRoute}
        onHeadingChange={(h) => setHeading((prev) => (Math.abs(prev - h) > 1 ? h : prev))}
      />

      {/* Üst katman: başlık, arama, filtreler */}
      <View pointerEvents="box-none" className="absolute inset-x-0 top-0">
        <View
          className="flex-row items-center justify-between bg-surface/90 px-margin pb-space-sm"
          style={{ paddingTop: insets.top + 8 }}
        >
          <View className="flex-row items-center gap-space-sm">
            <Text variant="headline-sm" className="text-brand">
              Rota
            </Text>
            <Text variant="headline-sm" className="text-outline-variant">
              •
            </Text>
            <Text variant="headline-sm" accessibilityRole="header">
              {tr.map.title}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr.map.profile}
            onPress={() => router.push('/profile')}
            className="h-11 w-11 items-center justify-center"
          >
            <View className="h-8 w-8 items-center justify-center rounded-full bg-brand">
              <Text variant="label-sm" className="font-bold text-white">
                {initial}
              </Text>
            </View>
          </Pressable>
        </View>
        <View pointerEvents="box-none" className="mt-space-sm gap-space-sm">
          <SearchBar />
          <ActivityFilterChips value={activity} onChange={setActivity} />
          {weather.data ? (
            <WeatherChip
              current={weather.data.weather.current}
              onPress={() => setWeatherOpen(true)}
            />
          ) : null}
        </View>
      </View>

      <View className="absolute right-4" style={{ top: insets.top + 200 }}>
        <MapControls
          heading={heading}
          locateDisabled={!location.coords}
          onLocate={() => mapRef.current?.recenter()}
          onResetNorth={() => mapRef.current?.resetNorth()}
          onCourses={() => router.push('/courses')}
        />
      </View>

      <Animated.View
        pointerEvents="box-none"
        className="absolute inset-x-0 top-0 items-center"
        style={fabStyle}
      >
        <Button
          title={tr.map.createRoute}
          className="bg-accent-deep active:bg-accent-pressed"
          style={shadows.record}
          onPress={startWizard}
        />
      </Animated.View>

      <WeatherSheet
        visible={weatherOpen}
        onClose={() => setWeatherOpen(false)}
        data={weather.data}
        loading={weather.isPending}
        error={weather.isError}
        onRetry={() => void weather.refetch()}
        usingDefaultLocation={weather.usingDefaultLocation}
        initialActivity={profile?.activity_prefs?.[0]}
      />

      <BottomSheet snapPoints={SNAP_POINTS} initialIndex={1} animatedPosition={sheetTop}>
        <NearbyRoutesSheet
          routes={routesQuery.data}
          loading={routesQuery.isLoading || location.status === 'loading'}
          error={routesQuery.isError}
          onRetry={() => void routesQuery.refetch()}
          onRoutePress={openRoute}
          locationDenied={location.status === 'denied'}
          onRequestLocation={() => void location.requestPermission()}
          canAskLocationAgain={location.canAskAgain}
        />
      </BottomSheet>
    </View>
  );
}
