/** Coğrafi ve biçimleme yardımcıları (saf fonksiyonlar). Koordinatlar [lng, lat]. */

export type LngLat = [lng: number, lat: number];

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** İki nokta arası büyük daire mesafesi (metre). */
export function haversineM(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** a'dan b'ye gidiş yönü: 0 = kuzey, 90 = doğu (derece, 0–360). */
export function bearingDeg(a: LngLat, b: LngLat): number {
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLng = toRad(b[0] - a[0]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Yeni yönü önceki değere en kısa dönüşle bağlar (359° → 1° geçişinde harita 358° ters dönmesin).
 * Dönen değer 0–360 dışına çıkabilir; kamera için sorun değildir.
 */
export function unwrapHeading(prev: number, next: number): number {
  let delta = (next - prev) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return prev + delta;
}

/** Çizginin toplam uzunluğu (metre). */
export function lineLengthM(coords: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineM(coords[i - 1]!, coords[i]!);
  return total;
}

/** Çizgi boyunca yolun tam ortasındaki nokta (puan rozeti için). */
export function lineMidpoint(coords: LngLat[]): LngLat | null {
  if (coords.length === 0) return null;
  if (coords.length === 1) return coords[0]!;
  const half = lineLengthM(coords) / 2;
  let walked = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1]!;
    const b = coords[i]!;
    const seg = haversineM(a, b);
    if (walked + seg >= half) {
      const t = seg === 0 ? 0 : (half - walked) / seg;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    walked += seg;
  }
  return coords[coords.length - 1]!;
}

/** 4800 → "4,8 km"; 850 → "850 m" (ondalık ayraç virgül). */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = Math.round(meters / 100) / 10;
  return `${String(km).replace('.', ',')} km`;
}

/** 45 → "45 dk"; 60 → "1 sa"; 80 → "1 sa 20 dk". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} dk`;
  return m === 0 ? `${h} sa` : `${h} sa ${m} dk`;
}

/** 4.7 → "4,7" */
export function formatRating(rating: number): string {
  return rating.toFixed(1).replace('.', ',');
}
