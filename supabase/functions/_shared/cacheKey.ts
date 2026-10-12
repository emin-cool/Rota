import type { ParsedInput } from './schema.ts';

/** Koordinatı ~100 m'ye yuvarla (docs/03: önbellek anahtarı başlangıcı 100 m'ye yuvarlar). */
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const roundPair = (p: [number, number]): [number, number] => [round3(p[0]), round3(p[1])];

/** Sonucu etkileyen tüm girdileri sıralı, yuvarlanmış tek bir nesneye çevirir. */
export function canonicalInput(input: ParsedInput) {
  const extras = Object.fromEntries(
    Object.entries(input.extras)
      .filter(([, v]) => v !== undefined && v !== false && v !== 'any')
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return {
    a: input.activityType,
    r: input.routeType,
    s: roundPair(input.start),
    e: input.end ? roundPair(input.end) : null,
    t: input.durationMin ?? null,
    d: input.distanceM !== undefined ? Math.round(input.distanceM / 100) * 100 : null,
    // Tempo yalnızca koşuda sonucu etkiler; 5 sn'ye yuvarla.
    p:
      input.activityType === 'run' && input.paceSecPerKm !== undefined
        ? Math.round(input.paceSecPerKm / 5) * 5
        : null,
    sc: [...new Set(input.scenery)].sort(),
    sl: input.slope,
    x: extras,
  };
}

/** Önbellek anahtarı: kanonik girdinin SHA-256 özeti (hex). */
export async function inputHash(input: ParsedInput): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(canonicalInput(input)));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
