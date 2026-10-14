import Mapbox from '@rnmapbox/maps';
import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { unwrapHeading } from '@/lib/geo';
import { DEFAULT_CENTER } from '@/lib/mapConfig';
import { colors } from '@/theme/tokens';

import type { LiveMiniMapProps } from './liveMapTypes';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const line = (coords: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates: coords },
});

/** Eğimli görünümde konum noktası ekranın alt yarısına yerleşsin (ileriyi daha çok gör). */
const HEADING_PADDING_TOP = 180;
const PITCH_3D = 40;

/**
 * Canlı ekranın karanlık haritası: planlı rota (yeşil), yürünen iz (turuncu), son konum.
 * Rotalı kayıtta kamera rotanın gidiş yönüne döner (yön GPS'ten değil rota çizgisinden gelir)
 * ve konum ok olarak çizilir; serbest kayıtta harita kuzey yukarıda sabit, konum küçük bir nokta.
 */
export function LiveMiniMap({ route, track, current, heading, view }: LiveMiniMapProps) {
  const routeShape = useMemo(() => (route && route.length > 1 ? line(route) : null), [route]);
  const trackShape = useMemo(() => (track.length > 1 ? line(track) : null), [track]);
  const center = current ?? route?.[0] ?? DEFAULT_CENTER;

  const hasRoute = routeShape !== null;
  const followsHeading = hasRoute && view !== 'north' && heading !== null;
  // Yön 359° → 1° geçerken harita ters dönmesin: önceki değere en kısa dönüşle bağla.
  // (Render sırasında state ayarlama kalıbı: yalnızca yön değişince bir kez daha çizilir.)
  const [cam, setCam] = useState<{ input: number | null; value: number }>({
    input: null,
    value: 0,
  });
  if (followsHeading && heading !== cam.input) {
    setCam({ input: heading, value: unwrapHeading(cam.value, heading) });
  }
  const cameraHeading = followsHeading ? cam.value : 0;
  const pitch = followsHeading && view === 'heading3d' ? PITCH_3D : 0;
  // Kuzey görünümünde ok, kendi gidiş yönünü göstermek için döner; yön görünümünde hep yukarı bakar.
  const arrowRotation = hasRoute && !followsHeading && heading !== null ? heading : 0;

  return (
    <View className="flex-1 overflow-hidden">
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
          zoomLevel={followsHeading ? 16.2 : 15.2}
          heading={cameraHeading}
          pitch={pitch}
          padding={{
            paddingTop: followsHeading ? HEADING_PADDING_TOP : 0,
            paddingBottom: 0,
            paddingLeft: 0,
            paddingRight: 0,
          }}
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
            {hasRoute ? (
              <View
                className="h-9 w-9 items-center justify-center rounded-full bg-white"
                style={{ transform: [{ rotate: `${arrowRotation}deg` }] }}
              >
                <MaterialIcons name="navigation" size={24} color={colors.accent.DEFAULT} />
              </View>
            ) : (
              <View className="h-4 w-4 items-center justify-center rounded-full bg-white">
                <View className="h-2.5 w-2.5 rounded-full bg-accent" />
              </View>
            )}
          </Mapbox.MarkerView>
        ) : null}
      </Mapbox.MapView>
    </View>
  );
}
