import Mapbox from '@rnmapbox/maps';
import { useMemo } from 'react';

import { trackBounds } from '@/lib/activitySummary';
import type { LngLat } from '@/lib/geo';
import { colors } from '@/theme/tokens';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

type Props = { track: LngLat[] };

/** İzlenen yolu çizer (başlangıç yeşil, bitiş turuncu nokta); yola sığdırılmış, etkileşimsiz. */
export function ActivityTrackMap({ track }: Props) {
  const line = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: track },
    }),
    [track],
  );
  const ends = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { color: colors.brand.DEFAULT },
          geometry: { type: 'Point', coordinates: track[0]! },
        },
        {
          type: 'Feature',
          properties: { color: colors.accent.DEFAULT },
          geometry: { type: 'Point', coordinates: track[track.length - 1]! },
        },
      ],
    }),
    [track],
  );
  const b = trackBounds(track);

  return (
    <Mapbox.MapView
      style={{ flex: 1 }}
      styleURL={Mapbox.StyleURL.Light}
      compassEnabled={false}
      scaleBarEnabled={false}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      logoPosition={{ bottom: 8, left: 8 }}
      attributionPosition={{ bottom: 8, left: 88 }}
    >
      <Mapbox.Camera
        defaultSettings={{ centerCoordinate: track[0]!, zoomLevel: 13 }}
        bounds={
          b
            ? {
                ne: b.ne,
                sw: b.sw,
                paddingTop: 70,
                paddingBottom: 50,
                paddingLeft: 40,
                paddingRight: 40,
              }
            : undefined
        }
        animationDuration={0}
      />
      <Mapbox.ShapeSource id="activity-track" shape={line}>
        <Mapbox.LineLayer
          id="activity-casing"
          style={{ lineColor: colors.white, lineWidth: 9, lineCap: 'round', lineJoin: 'round' }}
        />
        <Mapbox.LineLayer
          id="activity-line"
          style={{
            lineColor: colors.brand.DEFAULT,
            lineWidth: 5,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      </Mapbox.ShapeSource>
      <Mapbox.ShapeSource id="activity-ends" shape={ends}>
        <Mapbox.CircleLayer
          id="activity-ends-circle"
          style={{
            circleRadius: 7,
            circleColor: ['get', 'color'],
            circleStrokeColor: colors.white,
            circleStrokeWidth: 3,
          }}
        />
      </Mapbox.ShapeSource>
    </Mapbox.MapView>
  );
}
