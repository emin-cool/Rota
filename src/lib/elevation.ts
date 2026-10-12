export type ElevationPoint = { d: number; z: number };

export type ElevationPaths = {
  /** Çizgi (stroke) yolu. */
  line: string;
  /** Altı dolu alan (fill) yolu. */
  area: string;
  minZ: number;
  maxZ: number;
};

/**
 * Yükseklik profilini SVG yollarına çevirir. Rakım aralığı çok küçükse (düz yol) çizgi ortada düz kalır,
 * küçük gürültü büyütülüp dik görünmesin diye en az 10 m'lik bir aralık varsayılır.
 */
export function buildElevationPaths(
  profile: ElevationPoint[],
  width: number,
  height: number,
  padding = 4,
): ElevationPaths | null {
  if (profile.length < 2 || width <= 0 || height <= 0) return null;

  const dMax = profile[profile.length - 1]!.d || 1;
  const zs = profile.map((p) => p.z);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const range = Math.max(maxZ - minZ, 10);
  const mid = (minZ + maxZ) / 2;
  const lo = mid - range / 2;

  const innerH = height - padding * 2;
  const x = (d: number) => (d / dMax) * width;
  const y = (z: number) => padding + innerH - ((z - lo) / range) * innerH;
  const f = (n: number) => n.toFixed(1);

  const points = profile.map((p) => `${f(x(p.d))},${f(y(p.z))}`);
  const line = `M${points.join(' L')}`;
  const area = `${line} L${f(width)},${f(height)} L0,${f(height)} Z`;
  return { line, area, minZ, maxZ };
}
