import Mapbox from '@rnmapbox/maps';
import { useEffect, useMemo, useRef } from 'react';

import { trackBounds } from '@/lib/activitySummary';
import type { LngLat } from '@/lib/geo';
import { routeColor } from '@/theme/routeColors';
import type { ExploreRoute } from '@/types/database';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

type Props = {
  routes: ExploreRoute[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/** Keşfet harita görünümü: sonuçların rota çizgileri; dokunulan rota kalın ve opak olur. */
export function ExploreMap({ routes, selectedId, onSelect }: Props) {
  const camera = useRef<Mapbox.Camera>(null);

  const collection = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: routes
        .filter((r) => r.geojson && r.geojson.coordinates.length > 1)
        .map((r, i) => ({
          type: 'Feature' as const,
          properties: { id: r.id, color: routeColor(i), selected: r.id === selectedId ? 1 : 0 },
          geometry: r.geojson!,
        }))
        .sort((a, b) => a.properties.selected - b.properties.selected),
    }),
    [routes, selectedId],
  );

  // Sonuç listesi değişince tüm rotalara sığdır.
  const count = routes.length;
  useEffect(() => {
    const all: LngLat[] = routes.flatMap((r) => (r.geojson?.coordinates ?? []) as LngLat[]);
    const b = trackBounds(all);
    if (b) camera.current?.fitBounds(b.ne, b.sw, [60, 40, 220, 40], 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  return (
    <Mapbox.MapView
      style={{ flex: 1 }}
      styleURL={Mapbox.StyleURL.Light}
      compassEnabled={false}
      scaleBarEnabled={false}
      logoPosition={{ bottom: 8, left: 8 }}
      attributionPosition={{ bottom: 8, left: 88 }}
    >
      <Mapbox.Camera
        ref={camera}
        defaultSettings={{ centerCoordinate: [29.0, 41.05], zoomLevel: 10.5 }}
      />
      <Mapbox.ShapeSource
        id="explore-routes"
        shape={collection}
        onPress={(e) => {
          const id = e.features[0]?.properties?.id;
          if (typeof id === 'string') onSelect(id);
        }}
      >
        <Mapbox.LineLayer
          id="explore-casing"
          style={{
            lineColor: '#ffffff',
            lineWidth: ['case', ['==', ['get', 'selected'], 1], 10, 6],
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
        <Mapbox.LineLayer
          id="explore-line"
          style={{
            lineColor: ['get', 'color'],
            lineWidth: ['case', ['==', ['get', 'selected'], 1], 6, 3],
            lineOpacity: ['case', ['==', ['get', 'selected'], 1], 1, 0.7],
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      </Mapbox.ShapeSource>
    </Mapbox.MapView>
  );
}
