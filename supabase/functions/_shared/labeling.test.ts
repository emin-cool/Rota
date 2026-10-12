import { pickAndLabel } from './labeling.ts';

const c = (total: number, scenic: number, ascentM: number, distanceM: number) => ({
  total,
  scenic,
  ascentM,
  distanceM,
});

describe('pickAndLabel', () => {
  it('en iyi 3 adayı seçip üç farklı etiket verir', () => {
    const a = c(90, 95, 40, 4300);
    const b = c(80, 60, 5, 4400);
    const d = c(70, 50, 30, 3900);
    const out = pickAndLabel([d, a, b, c(10, 99, 0, 100)]);
    expect(out.map((o) => o.label)).toEqual(['En manzaralı', 'En düz', 'En kısa']);
    expect(out[0]!.item).toBe(a);
    expect(out[1]!.item).toBe(b);
    expect(out[2]!.item).toBe(d);
  });

  it('çakışırsa sonraki adaya geçer: aynı aday iki etiketi almaz', () => {
    const best = c(90, 95, 0, 3900); // hem en manzaralı, hem en düz, hem en kısa
    const second = c(80, 60, 10, 4300);
    const third = c(70, 50, 20, 4400);
    const out = pickAndLabel([best, second, third]);
    expect(out[0]).toMatchObject({ label: 'En manzaralı', item: best });
    expect(out[1]).toMatchObject({ label: 'En düz', item: second });
    expect(out[2]).toMatchObject({ label: 'En kısa', item: third });
  });

  it('3 adaydan azsa daha az etiket döner', () => {
    expect(pickAndLabel([c(50, 50, 5, 4000)])).toHaveLength(1);
    expect(pickAndLabel([])).toEqual([]);
  });
});
