import type { LngLat } from '@/lib/geo';

export type PointPickerProps = {
  /** Harita ilk açıldığında ortalanacak nokta. */
  initialCenter: LngLat;
  /** Harita durduğunda ekranın ortasındaki koordinat. */
  onCenterChange: (center: LngLat) => void;
  /** Kamerayı bu noktaya uçurur; `key` her değiştiğinde yeniden uçar. */
  flyTo: { point: LngLat; key: number } | null;
  /** Ortadaki işaretçinin rengi (başlangıç yeşil, bitiş turuncu). */
  pinColor: string;
  /** Sabit duran diğer noktalar (A→B'de seçilmiş başlangıç gibi). */
  fixedPoints: { point: LngLat; color: string }[];
  showUserLocation: boolean;
  /** Seçili noktanın çevresine çizilecek daire yarıçapı (metre); gizlilik bölgesi seçiminde kullanılır. */
  radiusM?: number;
};
