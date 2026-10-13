import {
  type WeeklyRow,
  barRatio,
  formatActivityWhen,
  formatChange,
  formatTotalHours,
  formatTotalKm,
  isValidDisplayName,
  isValidUsername,
  normalizeUsername,
  summarizeWeek,
} from './profileStats';

const row = (n: number): WeeklyRow => ({
  day: `2026-10-${String(n).padStart(2, '0')}`,
  distance_m: 0,
});

describe('formatTotalKm / formatTotalHours', () => {
  it('virgüllü tek ondalık', () => {
    expect(formatTotalKm(148_600)).toBe('148,6');
    expect(formatTotalKm(0)).toBe('0,0');
    expect(formatTotalHours(102_600)).toBe('28,5');
    expect(formatTotalHours(0)).toBe('0,0');
  });
});

describe('summarizeWeek', () => {
  it('geçen hafta / bu hafta ayrılır, değişim % hesaplanır', () => {
    const rows = Array.from({ length: 14 }, (_, i) => row(i + 1));
    rows[0]!.distance_m = 10_000; // geçen hafta
    rows[8]!.distance_m = 8_500; // bu haftanın Salı'sı
    rows[12]!.distance_m = '3000'; // bu haftanın Cumartesi'si (metin gelirse)
    const s = summarizeWeek(rows);
    expect(s.thisTotalM).toBe(11_500);
    expect(s.lastTotalM).toBe(10_000);
    expect(s.changePct).toBe(15);
    expect(s.peakIndex).toBe(1);
    expect(s.thisWeekM).toHaveLength(7);
  });
  it('geçen hafta 0 ise değişim null; hiç mesafe yoksa zirve null', () => {
    const s = summarizeWeek(Array.from({ length: 14 }, (_, i) => row(i + 1)));
    expect(s.changePct).toBeNull();
    expect(s.peakIndex).toBeNull();
  });
  it('eksik satırları 0 ile doldurur', () => {
    expect(summarizeWeek([]).thisWeekM).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('barRatio / formatChange', () => {
  it('oranlar', () => {
    expect(barRatio(50, 100)).toBe(0.5);
    expect(barRatio(5, 0)).toBe(0);
    expect(barRatio(200, 100)).toBe(1);
  });
  it('işaretli değişim', () => {
    expect(formatChange(15)).toBe('+%15');
    expect(formatChange(-8)).toBe('-%8');
    expect(formatChange(0)).toBe('%0');
  });
});

describe('kullanıcı adı / isim', () => {
  it('normalize eder ve doğrular', () => {
    expect(normalizeUsername('  @Emre_Aksoy ')).toBe('emre_aksoy');
    expect(isValidUsername('@Emre_Aksoy')).toBe(true);
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('emre aksoy')).toBe(false);
    expect(isValidUsername('emre.aksoy')).toBe(false);
    expect(isValidUsername('a'.repeat(31))).toBe(false);
  });
  it('isim uzunluğu', () => {
    expect(isValidDisplayName(' A ')).toBe(false);
    expect(isValidDisplayName('Emre')).toBe(true);
    expect(isValidDisplayName('x'.repeat(41))).toBe(false);
  });
});

describe('formatActivityWhen', () => {
  const now = new Date(2026, 9, 13, 12, 0);
  it('bugün / dün / n gün önce / tarih', () => {
    expect(formatActivityWhen(new Date(2026, 9, 13, 9, 5).toISOString(), now)).toMatch(/^Bugün · /);
    expect(formatActivityWhen(new Date(2026, 9, 12, 23, 0).toISOString(), now)).toMatch(/^Dün · /);
    expect(formatActivityWhen(new Date(2026, 9, 10, 8, 15).toISOString(), now)).toMatch(
      /^3 gün önce · /,
    );
    expect(formatActivityWhen(new Date(2026, 8, 1, 8, 15).toISOString(), now)).toMatch(
      /^1 Eylül · /,
    );
  });
});
