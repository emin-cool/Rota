import { MaterialIcons } from '@expo/vector-icons';
import Mapbox from '@rnmapbox/maps';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { DEFAULT_ZOOM, USER_ZOOM } from '@/lib/mapConfig';

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
}: PointPickerProps) {
  const camera = useRef<Mapbox.Camera>(null);

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
          if (lng !== undefined && lat !== undefined) onCenterChange([lng, lat]);
        }}
      >
        <Mapbox.Camera
          ref={camera}
          defaultSettings={{ centerCoordinate: initialCenter, zoomLevel: DEFAULT_ZOOM + 2 }}
        />
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
