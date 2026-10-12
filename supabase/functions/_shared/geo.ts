import type { Coord3, LngLat } from './types.ts';

const EARTH_RADIUS_M = 6_371_000;
// 6371 km yarıçaplı kürede 1° = 111,195 m (haversine ile tutarlı).
const M_PER_DEG = 111_195;
const M_PER_DEG_LAT = M_PER_DEG;
const M_PER_DEG_LNG_EQ = M_PER_DEG;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function haversineM(a: LngLat | Coord3, b: LngLat | Coord3): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lineLengthM(coords: (LngLat | Coord3)[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineM(coords[i - 1]!, coords[i]!);
  return total;
}

/** Başlangıçtan `bearingDeg` yönünde (0 = kuzey) `distM` metre ötedeki nokta. */
export function destinationPoint(origin: LngLat, bearingDeg: number, distM: number): LngLat {
  const δ = distM / EARTH_RADIUS_M;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(origin[1]);
  const λ1 = toRad(origin[0]);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return [toDeg(λ2), toDeg(φ2)];
}

export type Sample = { d: number; point: LngLat; z: number };

/** Çizgiyi başlangıçtan itibaren her `stepM` metrede bir örnekler (son nokta dahil). */
export function resample(coords: Coord3[], stepM: number): Sample[] {
  if (coords.length === 0) return [];
  const first = coords[0]!;
  if (coords.length === 1) return [{ d: 0, point: [first[0], first[1]], z: first[2] }];

  const cumulative: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    cumulative.push(cumulative[i - 1]! + haversineM(coords[i - 1]!, coords[i]!));
  }
  const total = cumulative[cumulative.length - 1]!;

  const targets: number[] = [];
  for (let d = 0; d < total; d += stepM) targets.push(d);
  const last = targets[targets.length - 1];
  if (last === undefined) {
    targets.push(total);
  } else if (total - last > 1e-6) {
    // Son örnek bitişe çok yakınsa (adımın yarısından az) onu bitişe kaydır; ilk örneği asla silme.
    if (total - last > stepM / 2 || targets.length === 1) targets.push(total);
    else targets[targets.length - 1] = total;
  }

  const samples: Sample[] = [];
  let seg = 1;
  for (const d of targets) {
    while (seg < coords.length - 1 && cumulative[seg]! < d) seg++;
    const a = coords[seg - 1]!;
    const b = coords[seg]!;
    const segLen = cumulative[seg]! - cumulative[seg - 1]!;
    const t = segLen === 0 ? 0 : Math.min(1, Math.max(0, (d - cumulative[seg - 1]!) / segLen));
    samples.push({
      d,
      point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
      z: a[2] + (b[2] - a[2]) * t,
    });
  }
  return samples;
}

/** p noktasının a-b doğru parçasına en kısa mesafesi (metre; yerel düzlem yaklaşımı). */
export function distPointToSegmentM(p: LngLat, a: LngLat, b: LngLat): number {
  const kx = Math.cos(toRad(p[1])) * M_PER_DEG_LNG_EQ;
  const ax = (a[0] - p[0]) * kx;
  const ay = (a[1] - p[1]) * M_PER_DEG_LAT;
  const bx = (b[0] - p[0]) * kx;
  const by = (b[1] - p[1]) * M_PER_DEG_LAT;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

export function distPointToPolylineM(p: LngLat, line: LngLat[]): number {
  if (line.length === 0) return Infinity;
  if (line.length === 1) return haversineM(p, line[0]!);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    best = Math.min(best, distPointToSegmentM(p, line[i - 1]!, line[i]!));
  }
  return best;
}

/** Işın atma yöntemiyle nokta çokgenin içinde mi? (lng/lat düzleminde) */
export function pointInRing(p: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export type BBox = { south: number; west: number; north: number; east: number };

/** Noktaların sınır kutusu, her yöne `bufferM` metre genişletilmiş. */
export function bboxOf(points: LngLat[], bufferM = 0): BBox {
  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;
  for (const [lng, lat] of points) {
    south = Math.min(south, lat);
    north = Math.max(north, lat);
    west = Math.min(west, lng);
    east = Math.max(east, lng);
  }
  const dLat = bufferM / M_PER_DEG_LAT;
  const dLng = bufferM / (M_PER_DEG_LNG_EQ * Math.cos(toRad((south + north) / 2)));
  return { south: south - dLat, west: west - dLng, north: north + dLat, east: east + dLng };
}

export function bboxAreaKm2(b: BBox): number {
  const heightKm = ((b.north - b.south) * M_PER_DEG_LAT) / 1000;
  const widthKm =
    ((b.east - b.west) * M_PER_DEG_LNG_EQ * Math.cos(toRad((b.south + b.north) / 2))) / 1000;
  return heightKm * widthKm;
}

/** Gidiş rotasının aynasını ekler: A→B + B→A (gidiş-dönüş). Rakım da tersine akar. */
export function mirrorRoute(coords: Coord3[]): Coord3[] {
  return coords.concat(coords.slice(0, -1).reverse());
}

/** ~50 m'lik hücreler: iki rotanın ne kadar çakıştığını ölçmek için. */
export function cellKeys(coords: (LngLat | Coord3)[], cellDeg = 0.0005): Set<string> {
  const keys = new Set<string>();
  for (const c of coords) keys.add(`${Math.round(c[0] / cellDeg)}_${Math.round(c[1] / cellDeg)}`);
  return keys;
}

/** İki kümenin kesişim / küçük kümenin boyutu (0–1). 1 = biri diğerinin içinde. */
export function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let common = 0;
  for (const k of a) if (b.has(k)) common++;
  return common / Math.min(a.size, b.size);
}
