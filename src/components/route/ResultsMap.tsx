import Mapbox from '@rnmapbox/maps';
import { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { formatDistance, formatDuration, lineMidpoint, type LngLat } from '@/lib/geo';
import { routeColor } from '@/theme/routeColors';
import { colors } from '@/theme/tokens';

import type { ResultsMapProps } from './resultsMapTypes';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

function boundsOf(coords: LngLat[]): { ne: LngLat; sw: LngLat } {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [lng, lat] of coords) {
    w = Math.min(w, lng);
    e = Math.max(e, lng);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  return { ne: [e, n], sw: [w, s] };
}

/** 3 rotayı farklı renkle çizer; seçili olan kalın ve opak, diğerleri soluk. */
export function ResultsMap({ routes, selected, start, startName, onSelect }: ResultsMapProps) {
  const camera = useRef<Mapbox.Camera>(null);

  const collection = useMemo<GeoJSON.FeatureCollection>(() => {
    const features = routes.map((r, i) => ({
      type: 'Feature' as const,
      id: i,
      properties: { index: i, color: routeColor(i), selected: i === selected ? 1 : 0 },
      geometry: r.geojson as GeoJSON.LineString,
    }));
    // Seçili rota en üstte çizilsin.
    return {
      type: 'FeatureCollection',
      features: features.sort((a, b) => a.properties.selected - b.properties.selected),
    };
  }, [routes, selected]);

  // Seçili rotaya sığdır.
  useEffect(() => {
    const coords = routes[selected]?.geojson.coordinates;
    if (!coords || coords.length < 2) return;
    const { ne, sw } = boundsOf(coords);
    camera.current?.fitBounds(ne, sw, [90, 50, 50, 50], 600);
  }, [routes, selected]);

  const selectedRoute = routes[selected];
  const mid = selectedRoute ? lineMidpoint(selectedRoute.geojson.coordinates) : null;

  return (
    <Mapbox.MapView
      style={{ flex: 1 }}
      styleURL={Mapbox.StyleURL.Light}
      compassEnabled={false}
      scaleBarEnabled={false}
      logoPosition={{ bottom: 8, left: 8 }}
      attributionPosition={{ bottom: 8, left: 88 }}
    >
      <Mapbox.Camera ref={camera} defaultSettings={{ centerCoordinate: start, zoomLevel: 13 }} />

      <Mapbox.ShapeSource
        id="result-routes"
        shape={collection}
        onPress={(e) => {
          const i = e.features[0]?.properties?.index;
          if (typeof i === 'number') onSelect(i);
        }}
      >
        <Mapbox.LineLayer
          id="result-casing"
          style={{
            lineColor: '#ffffff',
            lineWidth: ['case', ['==', ['get', 'selected'], 1], 10, 6],
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
        <Mapbox.LineLayer
          id="result-line"
          style={{
            lineColor: ['get', 'color'],
            lineWidth: ['case', ['==', ['get', 'selected'], 1], 6, 3],
            lineOpacity: ['case', ['==', ['get', 'selected'], 1], 1, 0.6],
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      </Mapbox.ShapeSource>

      {/* Başlangıç noktası */}
      <Mapbox.MarkerView coordinate={start} anchor={{ x: 0.5, y: 1 }}>
        <View className="items-center">
          <View className="max-w-[220px] flex-row items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow">
            <View
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colors.brand.DEFAULT }}
            />
            <Text variant="label-sm" className="font-bold" numberOfLines={1}>
              {tr.results.startLabel(startName ?? tr.results.defaultStartName)}
            </Text>
          </View>
        </View>
      </Mapbox.MarkerView>

      {/* Seçili rotanın özeti */}
      {mid && selectedRoute ? (
        <Mapbox.MarkerView coordinate={mid} anchor={{ x: 0.5, y: 0.5 }}>
          <View
            className="rounded-full px-3 py-1.5"
            style={{ backgroundColor: routeColor(selected) }}
          >
            <Text variant="label-sm" className="font-bold text-white">
              {formatDistance(selectedRoute.distanceM)} •{' '}
              {formatDuration(selectedRoute.estDurationMin)}
            </Text>
          </View>
        </Mapbox.MarkerView>
      ) : null}
    </Mapbox.MapView>
  );
}
