/** Profil sekmesi için saf hesaplamalar (istatistik biçimleme, haftalık grafik). */

export const WEEKDAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

/** 148600 → "148,6" (km, tek ondalık, virgül). */
export function formatTotalKm(meters: number): string {
  return (Math.round(meters / 100) / 10).toFixed(1).replace('.', ',');
}

/** 102600 sn → "28,5" (saat). */
export function formatTotalHours(seconds: number): string {
  return (Math.round(seconds / 360) / 10).toFixed(1).replace('.', ',');
}

export type WeeklyRow = { day: string; distance_m: number | string };

export type WeeklySummary = {
  /** Bu haftanın günlük mesafeleri (Pzt…Paz), metre. */
  thisWeekM: number[];
  thisTotalM: number;
  lastTotalM: number;
  /** Geçen haftaya göre değişim (%), geçen hafta 0 ise null. */
  changePct: number | null;
  /** En çok mesafe yapılan günün indeksi; hiç mesafe yoksa null. */
  peakIndex: number | null;
};

/**
 * `my_weekly_distance()` 14 satır döner: ilk 7'si geçen hafta, son 7'si bu hafta.
 * (PostgREST bigint'i bazen metin olarak verir; Number'a çevrilir.)
 */
export function summarizeWeek(rows: WeeklyRow[]): WeeklySummary {
  const m = rows.map((r) => Number(r.distance_m) || 0);
  const last = m.slice(0, 7);
  const thisWeek = m.slice(7, 14);
  while (thisWeek.length < 7) thisWeek.push(0);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const thisTotalM = sum(thisWeek);
  const lastTotalM = sum(last);
  const max = Math.max(...thisWeek);
  return {
    thisWeekM: thisWeek,
    thisTotalM,
    lastTotalM,
    changePct: lastTotalM > 0 ? Math.round(((thisTotalM - lastTotalM) / lastTotalM) * 100) : null,
    peakIndex: max > 0 ? thisWeek.indexOf(max) : null,
  };
}

/** Çubuk yüksekliği oranı (0–1); en uzun gün 1. Veri yoksa 0. */
export function barRatio(valueM: number, maxM: number): number {
  return maxM > 0 ? Math.min(1, valueM / maxM) : 0;
}

/** "+%15" / "-%8" / "%0". */
export function formatChange(pct: number): string {
  if (pct > 0) return `+%${pct}`;
  if (pct < 0) return `-%${Math.abs(pct)}`;
  return '%0';
}

/** Kullanıcı adı kuralı (veritabanı check'iyle aynı): küçük harf, rakam, alt çizgi; 3–30. */
export const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_RE.test(normalizeUsername(raw));
}

/** İsim: boşluklar kırpılır, 2–40 karakter. */
export function isValidDisplayName(raw: string): boolean {
  const n = raw.trim();
  return n.length >= 2 && n.length <= 40;
}

/** Aktivite listesi tarihi: "Bugün · 19:42", "Dün · 08:15", "3 gün önce · 08:15", sonra "12 Ekim · 08:15". */
export function formatActivityWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  let day: string;
  if (days <= 0) day = 'Bugün';
  else if (days === 1) day = 'Dün';
  else if (days < 7) day = `${days} gün önce`;
  else day = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  return `${day} · ${time}`;
}
