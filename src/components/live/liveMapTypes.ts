import type { LngLat } from '@/lib/geo';

export type LiveMiniMapProps = {
  /** Planlı rota (varsa). */
  route: LngLat[] | null;
  /** Yürünen iz. */
  track: LngLat[];
  /** Son konum. */
  current: LngLat | null;
};
