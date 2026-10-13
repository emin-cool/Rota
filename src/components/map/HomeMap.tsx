import Mapbox from '@rnmapbox/maps';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { formatRating, lineMidpoint, type LngLat } from '@/lib/geo';
import { DEFAULT_CENTER, DEFAULT_ZOOM, USER_ZOOM } from '@/lib/mapConfig';
import { colors } from '@/theme/tokens';

import type { HomeMapHandle, HomeMapProps } from './homeMapTypes';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

/** Rota çizgilerini aktivite rengiyle boyar; MapView'e tek bir ShapeSource olarak verilir. */
function toFeatureCollection(routes: HomeMapProps['routes']): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: routes
      .filter((r) => r.geojson && r.geojson.coordinates.length > 1)
      .map((r) => ({
        type: 'Feature' as const,
        id: r.id,
        properties: { id: r.id, color: colors.activity[r.activity_type] },
        geometry: r.geojson as GeoJSON.LineString,
      })),
  };
}

export const HomeMap = forwardRef<HomeMapHandle, HomeMapProps>(function HomeMap(
  { routes, userCoords, locationGranted, onRoutePress, onHeadingChange },
  ref,
) {
  const camera = useRef<Mapbox.Camera>(null);
  const flewToUser = useRef(false);

  const collection = useMemo(() => toFeatureCollection(routes), [routes]);
  const badges = useMemo(
    () =>
      routes.flatMap((r) => {
        const mid = r.geojson ? lineMidpoint(r.geojson.coordinates as LngLat[]) : null;
        return mid ? [{ route: r, at: mid }] : [];
      }),
    [routes],
  );

  // İlk konum geldiğinde kamerayı bir kez kullanıcıya uçur.
  useEffect(() => {
    if (userCoords && !flewToUser.current) {
      flewToUser.current = true;
      camera.current?.setCamera({
        centerCoordinate: userCoords,
        zoomLevel: USER_ZOOM,
        animationDuration: 800,
      });
    }
  }, [userCoords]);

  useImperativeHandle(
    ref,
    () => ({
      recenter: () => {
        if (userCoords) {
          camera.current?.setCamera({
            centerCoordinate: userCoords,
            zoomLevel: USER_ZOOM,
            animationDuration: 600,
          });
        }
      },
      resetNorth: () => camera.current?.setCamera({ heading: 0, animationDuration: 400 }),
    }),
    [userCoords],
  );

  return (
    <Mapbox.MapView
      style={{ flex: 1 }}
      styleURL={Mapbox.StyleURL.Light}
      compassEnabled={false}
      scaleBarEnabled={false}
      logoPosition={{ bottom: 124, left: 8 }}
      attributionPosition={{ bottom: 124, left: 88 }}
      onCameraChanged={(state) => onHeadingChange?.(state.properties.heading)}
    >
      <Mapbox.Camera
        ref={camera}
        defaultSettings={{ centerCoordinate: DEFAULT_CENTER, zoomLevel: DEFAULT_ZOOM }}
      />
      {locationGranted ? <Mapbox.LocationPuck puckBearingEnabled puckBearing="heading" /> : null}

      <Mapbox.ShapeSource
        id="routes"
        shape={collection}
        onPress={(e) => {
          const id = e.features[0]?.properties?.id;
          if (typeof id === 'string') onRoutePress(id);
        }}
      >
        <Mapbox.LineLayer
          id="routes-casing"
          style={{ lineColor: colors.white, lineWidth: 8, lineCap: 'round', lineJoin: 'round' }}
        />
        <Mapbox.LineLayer
          id="routes-line"
          style={{
            lineColor: ['get', 'color'],
            lineWidth: 5,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      </Mapbox.ShapeSource>

      {badges.map(({ route, at }) => (
        <Mapbox.MarkerView key={route.id} coordinate={at} anchor={{ x: 0.5, y: 0.5 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${route.title}, puan ${formatRating(route.avg_rating)}`}
            onPress={() => onRoutePress(route.id)}
          >
            <View className="min-h-[28px] flex-row items-center gap-1 rounded-full bg-white px-2.5 py-1 shadow">
              <View
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: colors.activity[route.activity_type] }}
              />
              <Text variant="label-sm" className="font-bold">
                {formatRating(route.avg_rating)} ★
              </Text>
              <Text variant="label-sm" className="text-ink-secondary">
                ({route.rating_count})
              </Text>
            </View>
          </Pressable>
        </Mapbox.MarkerView>
      ))}
    </Mapbox.MapView>
  );
});
