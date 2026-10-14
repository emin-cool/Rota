import Mapbox from '@rnmapbox/maps';
import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { tr } from '@/i18n/tr';
import { haversineM, type LngLat, unwrapHeading } from '@/lib/geo';
import { Text } from '@/components/ui';
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
/** Çekmece kapalıyken kapladığı yükseklik (live.tsx ile aynı); düğme bunun üstünde durur. */
const RECENTER_BOTTOM = 132;
/** Parmakla kaydırma bu kadar piksel uzaklaşınca kamera konumu izlemeyi bırakır. */
const PAN_BREAK_PX = 120;

/** Mapbox `onCameraChanged` olayından kullandığımız alanlar (tip paketin girişinden dışa aktarılmıyor). */
type CameraEvent = {
  properties: { center: number[]; zoom: number };
  gestures: { isGestureActive: boolean };
};

const metersPerPixel = (zoom: number, lat: number) =>
  (78271.517 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;

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
  // Kullanıcı yakınlaştırınca zoom korunur; kaydırınca kamera konumu izlemeyi bırakır ("Konuma dön" ile devam).
  const [follow, setFollow] = useState(true);
  const [userZoom, setUserZoom] = useState<number | null>(null);
  const [interacting, setInteracting] = useState(false);
  const onCameraChanged = (e: CameraEvent) => {
    if (!e.gestures.isGestureActive) return;
    const { zoom, center: c } = e.properties;
    setInteracting(true);
    setUserZoom((prev) => (prev !== null && Math.abs(prev - zoom) < 0.02 ? prev : zoom));
    if (follow && c.length >= 2) {
      const limitM = metersPerPixel(zoom, c[1]!) * PAN_BREAK_PX;
      if (haversineM(center, [c[0]!, c[1]!] as LngLat) > limitM) setFollow(false);
    }
  };
  const recenter = () => {
    setFollow(true);
    setInteracting(false);
  };

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
        scrollEnabled
        zoomEnabled
        rotateEnabled={false}
        pitchEnabled={false}
        onCameraChanged={onCameraChanged}
        onMapIdle={() => setInteracting(false)}
      >
        <Mapbox.Camera
          // Parmak haritadayken ya da kullanıcı kaydırmışken konum komutu gönderilmez (hareketi bölmesin).
          centerCoordinate={follow && !interacting ? center : undefined}
          zoomLevel={userZoom ?? (followsHeading ? 16.2 : 15.2)}
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
      {!follow ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.live.recenter}
          onPress={recenter}
          className="absolute right-3 min-h-[44px] flex-row items-center gap-2 rounded-full bg-black/70 px-4"
          style={{ bottom: RECENTER_BOTTOM }}
        >
          <MaterialIcons name="my-location" size={20} color={colors.white} />
          <Text variant="label-caps" className="text-white">
            {tr.live.recenter}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
