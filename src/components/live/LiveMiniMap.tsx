import Mapbox from '@rnmapbox/maps';
import { useMemo } from 'react';
import { View } from 'react-native';

import { DEFAULT_CENTER } from '@/lib/mapConfig';
import { colors } from '@/theme/tokens';

import type { LiveMiniMapProps } from './liveMapTypes';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const line = (coords: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates: coords },
});

/** Canlı ekranın karanlık mini haritası: planlı rota (yeşil), yürünen iz (turuncu), son konum. */
export function LiveMiniMap({ route, track, current }: LiveMiniMapProps) {
  const routeShape = useMemo(() => (route && route.length > 1 ? line(route) : null), [route]);
  const trackShape = useMemo(() => (track.length > 1 ? line(track) : null), [track]);
  const center = current ?? route?.[0] ?? DEFAULT_CENTER;

  return (
    <View className="flex-1 overflow-hidden rounded-xl">
      <Mapbox.MapView
        style={{ flex: 1 }}
        styleURL={Mapbox.StyleURL.Dark}
        compassEnabled={false}
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Mapbox.Camera
          centerCoordinate={center}
          zoomLevel={15.2}
          animationMode="easeTo"
          animationDuration={900}
        />
        {routeShape ? (
          <Mapbox.ShapeSource id="live-route" shape={routeShape}>
            <Mapbox.LineLayer
              id="live-route-line"
              style={{
                lineColor: colors.brand.mid,
                lineWidth: 4,
                lineOpacity: 0.85,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </Mapbox.ShapeSource>
        ) : null}
        {trackShape ? (
          <Mapbox.ShapeSource id="live-track" shape={trackShape}>
            <Mapbox.LineLayer
              id="live-track-line"
              style={{
                lineColor: colors.accent.DEFAULT,
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </Mapbox.ShapeSource>
        ) : null}
        {current ? (
          <Mapbox.MarkerView coordinate={current} anchor={{ x: 0.5, y: 0.5 }}>
            <View className="h-5 w-5 items-center justify-center rounded-full bg-white">
              <View className="h-3 w-3 rounded-full bg-accent" />
            </View>
          </Mapbox.MarkerView>
        ) : null}
      </Mapbox.MapView>
    </View>
  );
}
