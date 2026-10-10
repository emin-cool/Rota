import type { LngLat } from '@/lib/geo';
import type { NearbyRoute } from '@/types/database';

export type HomeMapProps = {
  routes: NearbyRoute[];
  /** Kullanıcının ilk alınan konumu; kamera bir kez buraya uçar. */
  userCoords: LngLat | null;
  locationGranted: boolean;
  onRoutePress: (routeId: string) => void;
  /** Harita dönünce derece cinsinden yön (pusula butonu için). */
  onHeadingChange?: (heading: number) => void;
};

/** Ekranın haritaya verdiği komutlar. */
export type HomeMapHandle = {
  recenter: () => void;
  resetNorth: () => void;
};
