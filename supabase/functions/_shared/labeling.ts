/** Etiketlemeye giren aday (yalnızca gereken alanlar). */
export type Labelable = {
  total: number;
  scenic: number;
  ascentM: number;
  distanceM: number;
  /** Kartta gösterilen tahmini süre (dk); tırmanış dahil. */
  durationMin: number;
};

export const LABELS = {
  scenic: 'En manzaralı',
  flat: 'En düz',
  short: 'En kısa',
  /** Hiçbir ölçütte birinci olmayan, skora göre doldurulan kart. */
  alternative: 'Alternatif',
  /** Tek bir rota varsa. */
  single: 'Önerilen',
  /** Üç ölçütte de birinci olan rota. */
  all: 'Her açıdan en iyi',
} as const;

/** Birleşik etiketlerde ayraç ("En manzaralı + En düz"). İstemci ilk etiketten ikon seçer. */
export const LABEL_SEPARATOR = ' + ';

/** Etiket kazanabilecek aday havuzu: en iyi skordan en çok bu kadar geride ve en çok bu kadar aday. */
export const POOL_TOTAL_MARGIN = 20;
export const POOL_SIZE = 6;

type Criterion<T> = { label: string; better: (a: T, b: T) => boolean };

function criteria<T extends Labelable>(): Criterion<T>[] {
  return [
    { label: LABELS.scenic, better: (a, b) => a.scenic > b.scenic },
    { label: LABELS.flat, better: (a, b) => a.ascentM < b.ascentM },
    {
      label: LABELS.short,
      better: (a, b) =>
        a.durationMin < b.durationMin ||
        (a.durationMin === b.durationMin && a.distanceM < b.distanceM),
    },
  ];
}

/** Adaylar arasında ölçütte en iyi olan; eşitlikte listede önce gelen (yüksek skorlu) kalır. */
function bestOf<T extends Labelable>(items: readonly T[], c: Criterion<T>): T {
  let best = items[0]!;
  for (let i = 1; i < items.length; i++) if (c.better(items[i]!, best)) best = items[i]!;
  return best;
}

/**
 * Gösterilecek en çok `count` rotayı seçer ve DOĞRU etiketler. Kural: bir etiket, gösterilen rotalar
 * arasında o ölçütte gerçekten en iyi olana verilir (başka bir kart daha manzaralı/düz/kısa olamaz).
 *
 * 1. Havuz: skoru en iyiden en çok `POOL_TOTAL_MARGIN` geride kalan en iyi `POOL_SIZE` aday.
 *    (Hedeften çok sapmış kötü bir rota yalnızca "kısa" diye öne çıkmasın.)
 * 2. Seçim: havuzda her ölçütün (manzara, tırmanış, tahmini süre) kazananı; kalan yerler skora göre doldurulur.
 * 3. Etiket: her ölçütün birincisi, GÖSTERİLENLER arasından belirlenir. Birden çok ölçütü kazanan rota
 *    birleşik etiket alır ("En manzaralı + En düz"); hiçbirini kazanmayan "Alternatif" olur.
 *
 * Çıktı sırası: etiketli kartlar ölçüt sırasına (manzaralı → düz → kısa), sonra alternatifler.
 */
export function pickAndLabel<T extends Labelable>(
  candidates: readonly T[],
  count = 3,
): { label: string; item: T }[] {
  const sorted = [...candidates].sort((a, b) => b.total - a.total);
  if (sorted.length === 0) return [];
  const rules = criteria<T>();

  const pool = sorted
    .filter((c) => c.total >= sorted[0]!.total - POOL_TOTAL_MARGIN)
    .slice(0, POOL_SIZE);

  const shown: T[] = [];
  for (const rule of rules) {
    if (shown.length >= count) break;
    const winner = bestOf(pool, rule);
    if (!shown.includes(winner)) shown.push(winner);
  }
  for (const c of sorted) {
    if (shown.length >= count) break;
    if (!shown.includes(c)) shown.push(c);
  }

  if (shown.length === 1) return [{ label: LABELS.single, item: shown[0]! }];

  // Gösterilenler arasında birinci olanlar (eşitlikte skoru yüksek olan).
  const byScore = [...shown].sort((a, b) => b.total - a.total);
  const won = new Map<T, { order: number; labels: string[] }>();
  rules.forEach((rule, order) => {
    const winner = bestOf(byScore, rule);
    const entry = won.get(winner) ?? { order, labels: [] };
    entry.labels.push(rule.label);
    won.set(winner, entry);
  });

  const labeled = [...won.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([item, { labels }]) => ({
      label: labels.length === rules.length ? LABELS.all : labels.join(LABEL_SEPARATOR),
      item,
    }));
  const alternatives = byScore
    .filter((c) => !won.has(c))
    .map((item) => ({ label: LABELS.alternative, item }));
  return [...labeled, ...alternatives];
}
