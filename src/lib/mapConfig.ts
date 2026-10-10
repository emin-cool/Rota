import type { LngLat } from '@/lib/geo';

/** Konum izni yoksa harita ve rota araması İstanbul Boğazı çevresinden başlar. */
export const DEFAULT_CENTER: LngLat = [29.04, 41.07];
export const DEFAULT_ZOOM = 12;
export const USER_ZOOM = 13.5;

/** "Yakınındaki popüler rotalar" arama yarıçapı (CLAUDE.md / P1.1: 3 km). */
export const NEARBY_RADIUS_M = 3000;
/** Konum yoksa merkez noktası kabaca bir şehir bölgesi olduğundan daha geniş ara. */
export const FALLBACK_RADIUS_M = 8000;
