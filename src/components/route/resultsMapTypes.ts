import type { LngLat } from '@/lib/geo';
import type { RouteOption } from '@/types/routes';

export type ResultsMapProps = {
  routes: RouteOption[];
  selected: number;
  start: LngLat;
  startName: string | null;
  onSelect: (index: number) => void;
};
