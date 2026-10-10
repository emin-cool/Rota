/** Tempo yardımcıları (saf fonksiyonlar). Birim: saniye/km. */

/** 330 → "5:30" */
export function formatPace(secPerKm: number): string {
  const total = Math.max(0, Math.round(secPerKm));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Tempoya göre kısa etiket (onboarding kaydırıcısı). */
export function paceLabel(secPerKm: number): 'fast' | 'medium' | 'easy' {
  if (secPerKm < 330) return 'fast';
  if (secPerKm <= 420) return 'medium';
  return 'easy';
}

/** Varsayılan koşu temposu: 6:30 dk/km (CLAUDE.md sabitleri). */
export const DEFAULT_RUN_PACE_SEC = 390;
export const PACE_MIN_SEC = 240; // 4:00
export const PACE_MAX_SEC = 450; // 7:30
