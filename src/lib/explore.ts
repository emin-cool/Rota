import type { ActivityType, Difficulty, ExploreArgs, RatingSummary } from '@/types/database';

/** Süre filtresi: kısa < 30 dk, orta 30–60 dk, uzun > 60 dk. */
export type DurationBucket = 'short' | 'medium' | 'long';

const DURATION_RANGE: Record<DurationBucket, { min: number | null; max: number | null }> = {
  short: { min: null, max: 29 },
  medium: { min: 30, max: 60 },
  long: { min: 61, max: null },
};

export type ExploreFilters = {
  query: string;
  activity: ActivityType | null;
  duration: DurationBucket | null;
  difficulty: Difficulty | null;
  district: string | null;
  topRated: boolean;
};

export const EMPTY_FILTERS: ExploreFilters = {
  query: '',
  activity: null,
  duration: null,
  difficulty: null,
  district: null,
  topRated: false,
};

export const PAGE_SIZE = 20;

/** Arama kutusu dışındaki aktif filtre sayısı (filtre düğmesindeki rozet için). */
export function countActiveFilters(f: ExploreFilters): number {
  return (
    [f.activity, f.duration, f.difficulty, f.district].filter(Boolean).length + (f.topRated ? 1 : 0)
  );
}

/** Arama ya da herhangi bir filtre var mı? (yoksa "popüler + editör" bölümleri gösterilir) */
export function hasAnyFilter(f: ExploreFilters): boolean {
  return f.query.trim() !== '' || countActiveFilters(f) > 0;
}

export function filtersToArgs(
  f: ExploreFilters,
  extra: Pick<ExploreArgs, 'p_offset' | 'p_limit' | 'p_featured_only' | 'p_sort' | 'p_scope'> = {},
): ExploreArgs {
  const range = f.duration ? DURATION_RANGE[f.duration] : null;
  return {
    p_query: f.query.trim() || null,
    p_activity: f.activity,
    p_min_duration: range?.min ?? null,
    p_max_duration: range?.max ?? null,
    p_difficulty: f.difficulty,
    p_district: f.district,
    p_min_rating: f.topRated ? 4 : null,
    p_limit: PAGE_SIZE,
    ...extra,
  };
}

/** Sayfalanan sonucun sonraki offset'i; son sayfa tam dolmadıysa devam yok. */
export function nextOffset(lastPageSize: number, loaded: number): number | undefined {
  return lastPageSize >= PAGE_SIZE ? loaded : undefined;
}

/** Puan çubuğunun doluluk yüzdesi (0–100); hiç yorum yoksa 0. */
export function ratingBarPercent(summary: RatingSummary, star: 1 | 2 | 3 | 4 | 5): number {
  if (summary.count <= 0) return 0;
  return Math.round((summary.dist[String(star) as '1'] / summary.count) * 100);
}

/** "3 gün önce", "1 hafta önce"… (Türkçe, kaba). */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'şimdi';
  if (min < 60) return `${min} dk önce`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} gün önce`;
  const w = Math.floor(d / 7);
  if (d < 30) return `${w} hafta önce`;
  const mo = Math.floor(d / 30);
  if (d < 365) return `${mo} ay önce`;
  return `${Math.floor(d / 365)} yıl önce`;
}

/** Ad soyaddan avatar baş harfleri: "Zeynep Tan" → "ZT". */
export function initials(name: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]![0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : '';
  return (first + last).toLocaleUpperCase('tr-TR');
}

/** Rota başlangıcına yol tarifi (Google Maps evrensel bağlantısı; iOS'ta Apple Maps). */
export function directionsUrl(lat: number, lng: number, platform: 'ios' | 'android'): string {
  return platform === 'ios'
    ? `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}
