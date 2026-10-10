import { formatPace, paceLabel } from './pace';

describe('formatPace', () => {
  it('saniyeyi dk:ss biçimine çevirir', () => {
    expect(formatPace(330)).toBe('5:30');
    expect(formatPace(390)).toBe('6:30');
    expect(formatPace(245)).toBe('4:05');
  });

  it('negatifleri sıfıra çeker ve yuvarlar', () => {
    expect(formatPace(-5)).toBe('0:00');
    expect(formatPace(329.6)).toBe('5:30');
  });
});

describe('paceLabel', () => {
  it('hızlı / orta / hafif', () => {
    expect(paceLabel(300)).toBe('fast');
    expect(paceLabel(390)).toBe('medium');
    expect(paceLabel(450)).toBe('easy');
  });
});
