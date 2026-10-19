import { LABELS, LABEL_SEPARATOR, pickAndLabel, type Labelable } from './labeling.ts';

const c = (
  total: number,
  scenic: number,
  ascentM: number,
  distanceM: number,
  durationMin = Math.round(distanceM / 80),
) => ({ total, scenic, ascentM, distanceM, durationMin });

describe('pickAndLabel', () => {
  it('üç ölçütün kazananı farklıysa üç ayrı etiket verir (manzaralı → düz → kısa)', () => {
    const a = c(90, 95, 40, 4300);
    const b = c(80, 60, 5, 4400);
    const d = c(70, 50, 30, 3900);
    const out = pickAndLabel([d, a, b, c(10, 99, 0, 100)]);
    expect(out.map((o) => o.label)).toEqual(['En manzaralı', 'En düz', 'En kısa']);
    expect(out.map((o) => o.item)).toEqual([a, b, d]);
  });

  it('bir rota iki ölçütü kazanırsa birleşik etiket alır, kalan kart Alternatif olur', () => {
    const best = c(90, 95, 0, 4300); // en manzaralı + en düz
    const quick = c(80, 60, 10, 3900); // en kısa
    const other = c(70, 50, 20, 4400);
    const out = pickAndLabel([other, quick, best]);
    expect(out).toEqual([
      { label: `En manzaralı${LABEL_SEPARATOR}En düz`, item: best },
      { label: 'En kısa', item: quick },
      { label: LABELS.alternative, item: other },
    ]);
  });

  it('üç ölçütte de birinci olan rota "Her açıdan en iyi" etiketi alır; diğerleri Alternatif', () => {
    const best = c(90, 95, 0, 3900);
    const second = c(80, 60, 10, 4300);
    const third = c(70, 50, 20, 4400);
    const out = pickAndLabel([best, second, third]);
    expect(out[0]).toEqual({ label: LABELS.all, item: best });
    expect(out.slice(1).map((o) => o.label)).toEqual([LABELS.alternative, LABELS.alternative]);
  });

  it('"En kısa" mesafeye değil kartta görünen tahmini süreye göre verilir', () => {
    const shortButSteep = c(80, 60, 80, 3900, 55); // kısa mesafe ama tırmanış süreyi uzatıyor
    const longButFlat = c(80, 60, 5, 4100, 52);
    const out = pickAndLabel([shortButSteep, longButFlat, c(70, 40, 40, 4300, 60)]);
    expect(out.find((o) => o.item === longButFlat)!.label).toContain('En kısa');
    expect(out.find((o) => o.item === shortButSteep)!.label).not.toContain('En kısa');
  });

  it('skoru çok düşük bir aday yalnızca kısa diye etiket kazanamaz (havuz dışı)', () => {
    const good1 = c(90, 90, 20, 4300, 54);
    const good2 = c(85, 70, 5, 4400, 55);
    const good3 = c(80, 60, 30, 4350, 53);
    const bad = c(20, 10, 80, 2000, 25); // hedeften çok sapmış ama en kısa
    const out = pickAndLabel([bad, good1, good2, good3]);
    expect(out.map((o) => o.item)).not.toContain(bad);
    expect(out.map((o) => o.label)).toEqual(['En manzaralı', 'En düz', 'En kısa']);
  });

  it('kart sayısını doldurmak için havuz dışından aday gelirse etiketler yine doğru kalır', () => {
    const a = c(90, 90, 10, 4300, 54);
    const b = c(40, 10, 50, 2000, 25); // havuz dışı, ama tek kalan: gösterilince en kısa olur
    const out = pickAndLabel([a, b], 3);
    const short = out.find((o) => o.label.includes('En kısa'))!;
    expect(short.item).toBe(b);
  });

  it('tek aday "Önerilen", aday yoksa boş döner', () => {
    expect(pickAndLabel([c(50, 50, 5, 4000)])).toEqual([
      { label: LABELS.single, item: expect.any(Object) },
    ]);
    expect(pickAndLabel([])).toEqual([]);
  });

  it('en çok istenen sayıda rota döner', () => {
    const many = Array.from({ length: 10 }, (_, i) => c(90 - i, 50 + i, 10 + i, 4000 + i * 10));
    expect(pickAndLabel(many)).toHaveLength(3);
    expect(pickAndLabel(many, 2)).toHaveLength(2);
  });
});

describe('pickAndLabel: etiket her zaman gösterilen kartlar arasında doğrudur (rastgele kümeler)', () => {
  // Deterministik sahte rastgele sayı üreteci.
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  it('hiçbir gösterilen kart, etiketli kartı o ölçütte geçemez', () => {
    for (let run = 0; run < 300; run++) {
      const n = 1 + Math.floor(rand() * 9);
      const cands: Labelable[] = Array.from({ length: n }, () =>
        c(
          Math.round(rand() * 100),
          Math.round(rand() * 100),
          Math.round(rand() * 80),
          3500 + Math.round(rand() * 1500),
          45 + Math.round(rand() * 20),
        ),
      );
      const out = pickAndLabel(cands);
      expect(out.length).toBeLessThanOrEqual(3);
      expect(new Set(out.map((o) => o.item)).size).toBe(out.length);

      const shown = out.map((o) => o.item);
      for (const { label, item } of out) {
        const parts =
          label === LABELS.all
            ? [LABELS.scenic, LABELS.flat, LABELS.short]
            : label.split(LABEL_SEPARATOR);
        for (const part of parts) {
          if (part === LABELS.scenic)
            expect(shown.every((o) => o.scenic <= item.scenic)).toBe(true);
          if (part === LABELS.flat)
            expect(shown.every((o) => o.ascentM >= item.ascentM)).toBe(true);
          if (part === LABELS.short)
            expect(shown.every((o) => o.durationMin >= item.durationMin)).toBe(true);
        }
      }
    }
  });
});
