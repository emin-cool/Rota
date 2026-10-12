/** Etiketlemeye giren aday (yalnızca gereken alanlar). */
export type Labelable = {
  total: number;
  scenic: number;
  ascentM: number;
  distanceM: number;
};

export const LABELS = {
  scenic: 'En manzaralı',
  flat: 'En düz',
  short: 'En kısa',
} as const;

/**
 * En iyi 3 adayı seçer ve etiketler. Her etiket sırayla (manzaralı → düz → kısa) kalan adaylar
 * arasında kendi ölçütüne göre en iyisine verilir; aynı aday iki etiketi birden alamaz
 * ("çakışırsa sonraki adaya geç"). Çıktı etiket sırasındadır.
 */
export function pickAndLabel<T extends Labelable>(
  candidates: readonly T[],
  count = 3,
): { label: string; item: T }[] {
  const pool = [...candidates].sort((a, b) => b.total - a.total).slice(0, count);

  const criteria: { label: string; better: (a: T, b: T) => boolean }[] = [
    { label: LABELS.scenic, better: (a, b) => a.scenic > b.scenic },
    { label: LABELS.flat, better: (a, b) => a.ascentM < b.ascentM },
    { label: LABELS.short, better: (a, b) => a.distanceM < b.distanceM },
  ];

  const result: { label: string; item: T }[] = [];
  const remaining = [...pool];
  for (const { label, better } of criteria) {
    if (remaining.length === 0) break;
    let best = 0;
    for (let i = 1; i < remaining.length; i++) {
      if (better(remaining[i]!, remaining[best]!)) best = i;
    }
    result.push({ label, item: remaining[best]! });
    remaining.splice(best, 1);
  }
  return result;
}
