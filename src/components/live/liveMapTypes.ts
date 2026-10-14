import type { LngLat } from '@/lib/geo';

/** Rotalı kayıtta harita görünümü: yöne dönük 3B, yöne dönük düz ya da kuzey yukarı. */
export type LiveMapView = 'heading3d' | 'headingFlat' | 'north';

export const LIVE_MAP_VIEWS: LiveMapView[] = ['heading3d', 'headingFlat', 'north'];

export const isLiveMapView = (v: string | null): v is LiveMapView =>
  v !== null && (LIVE_MAP_VIEWS as string[]).includes(v);

export type LiveMiniMapProps = {
  /** Planlı rota (varsa). Yoksa serbest kayıt: harita kuzey yukarıda sabit, yalnızca nokta gösterilir. */
  route: LngLat[] | null;
  /** Yürünen iz. */
  track: LngLat[];
  /** Son konum. */
  current: LngLat | null;
  /** Rotanın bulunulan yerdeki gidiş yönü (derece); yalnızca rotalı kayıtta. */
  heading: number | null;
  /** Rotalı kayıtta seçilen görünüm; serbest kayıtta yok sayılır. */
  view: LiveMapView;
};
