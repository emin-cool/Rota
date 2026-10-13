import { MaterialIcons } from '@expo/vector-icons';
import Mapbox from '@rnmapbox/maps';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { DEFAULT_ZOOM, USER_ZOOM } from '@/lib/mapConfig';
import { colors } from '@/theme/tokens';

import type { PointPickerProps } from './pointPickerTypes';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

/**
 * Haritayı kaydırarak nokta seçme: ekranın ortasındaki sabit işaretçinin altındaki koordinat seçilir.
 * Harita durunca (`onMapIdle`) merkez bildirilir.
 */
export function MapPointPicker({
  initialCenter,
  onCenterChange,
  flyTo,
  pinColor,
  fixedPoints,
  showUserLocation,
  radiusM,
}: PointPickerProps) {
  const camera = useRef<Mapbox.Camera>(null);
  // Daire, haritanın durduğu son merkezde çizilir (onMapIdle ile güncellenir).
  const [selected, setSelected] = useState(initialCenter);
  const circle = useMemo<GeoJSON.Feature<GeoJSON.Point>>(
    () => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: selected } }),
    [selected],
  );
  // Mapbox'ta circleRadius piksel cinsindendir: metreyi yakınlaştırmayla üstel ölçekleyerek sabit tutarız.
  const metersToPx0 = radiusM ? radiusM / (78271.517 * Math.cos((selected[1] * Math.PI) / 180)) : 0;

  useEffect(() => {
    if (!flyTo) return;
    camera.current?.setCamera({
      centerCoordinate: flyTo.point,
      zoomLevel: USER_ZOOM,
      animationDuration: 600,
    });
  }, [flyTo]);

  return (
    <View className="flex-1">
      <Mapbox.MapView
        style={{ flex: 1 }}
        styleURL={Mapbox.StyleURL.Light}
        compassEnabled={false}
        scaleBarEnabled={false}
        logoPosition={{ bottom: 150, left: 8 }}
        attributionPosition={{ bottom: 150, left: 88 }}
        onMapIdle={(state) => {
          const [lng, lat] = state.properties.center;
          if (lng !== undefined && lat !== undefined) {
            setSelected([lng, lat]);
            onCenterChange([lng, lat]);
          }
        }}
      >
        <Mapbox.Camera
          ref={camera}
          defaultSettings={{ centerCoordinate: initialCenter, zoomLevel: DEFAULT_ZOOM + 2 }}
        />
        {radiusM ? (
          <Mapbox.ShapeSource id="picker-radius" shape={circle}>
            <Mapbox.CircleLayer
              id="picker-radius-circle"
              style={{
                circleRadius: [
                  'interpolate',
                  ['exponential', 2],
                  ['zoom'],
                  0,
                  metersToPx0,
                  24,
                  metersToPx0 * 2 ** 24,
                ],
                circleColor: colors.brand.DEFAULT,
                circleOpacity: 0.2,
                circleStrokeColor: colors.brand.DEFAULT,
                circleStrokeWidth: 2,
              }}
            />
          </Mapbox.ShapeSource>
        ) : null}
        {showUserLocation ? <Mapbox.LocationPuck puckBearingEnabled puckBearing="heading" /> : null}
        {fixedPoints.map((p, i) => (
          <Mapbox.MarkerView key={i} coordinate={p.point} anchor={{ x: 0.5, y: 1 }}>
            <MaterialIcons name="place" size={36} color={p.color} />
          </Mapbox.MarkerView>
        ))}
      </Mapbox.MapView>

      {/* Sabit merkez işaretçisi: ucu ekranın tam ortasında */}
      <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
        <View style={{ transform: [{ translateY: -22 }] }}>
          <MaterialIcons name="place" size={48} color={pinColor} />
        </View>
      </View>
    </View>
  );
}
