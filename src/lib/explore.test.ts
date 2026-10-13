import {
  EMPTY_FILTERS,
  PAGE_SIZE,
  countActiveFilters,
  directionsUrl,
  filtersToArgs,
  hasAnyFilter,
  initials,
  nextOffset,
  ratingBarPercent,
  timeAgo,
} from './explore';
import type { RatingSummary } from '@/types/database';

describe('filtersToArgs', () => {
  it('boş filtre → hepsi null, 4★ yok', () => {
    const a = filtersToArgs(EMPTY_FILTERS);
    expect(a).toMatchObject({
      p_query: null,
      p_activity: null,
      p_min_duration: null,
      p_max_duration: null,
      p_difficulty: null,
      p_district: null,
      p_min_rating: null,
      p_limit: PAGE_SIZE,
    });
  });
  it('süre kovaları doğru aralığa çevrilir', () => {
    expect(filtersToArgs({ ...EMPTY_FILTERS, duration: 'short' })).toMatchObject({
      p_min_duration: null,
      p_max_duration: 29,
    });
    expect(filtersToArgs({ ...EMPTY_FILTERS, duration: 'medium' })).toMatchObject({
      p_min_duration: 30,
      p_max_duration: 60,
    });
    expect(filtersToArgs({ ...EMPTY_FILTERS, duration: 'long' })).toMatchObject({
      p_min_duration: 61,
      p_max_duration: null,
    });
  });
  it('4+★ → min puan 4; arama boşlukları kırpılır', () => {
    const a = filtersToArgs({ ...EMPTY_FILTERS, topRated: true, query: '  boğaz ' });
    expect(a.p_min_rating).toBe(4);
    expect(a.p_query).toBe('boğaz');
  });
  it('extra parametreler geçer', () => {
    expect(filtersToArgs(EMPTY_FILTERS, { p_offset: 40, p_featured_only: true })).toMatchObject({
      p_offset: 40,
      p_featured_only: true,
    });
  });
});

describe('filtre sayımı', () => {
  it('aktif filtreleri sayar, aramayı saymaz', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(
      countActiveFilters({
        ...EMPTY_FILTERS,
        query: 'x',
        activity: 'run',
        topRated: true,
        district: 'Kadıköy',
      }),
    ).toBe(3);
  });
  it('hasAnyFilter aramayı da sayar', () => {
    expect(hasAnyFilter(EMPTY_FILTERS)).toBe(false);
    expect(hasAnyFilter({ ...EMPTY_FILTERS, query: ' a ' })).toBe(true);
    expect(hasAnyFilter({ ...EMPTY_FILTERS, query: '   ' })).toBe(false);
  });
});

describe('nextOffset', () => {
  it('tam sayfa → devam; eksik sayfa → son', () => {
    expect(nextOffset(PAGE_SIZE, 20)).toBe(20);
    expect(nextOffset(PAGE_SIZE - 1, 39)).toBeUndefined();
    expect(nextOffset(0, 0)).toBeUndefined();
  });
});

describe('ratingBarPercent', () => {
  const s: RatingSummary = {
    count: 8,
    avg: 4.5,
    dist: { '1': 0, '2': 0, '3': 2, '4': 2, '5': 4 },
    tags: [],
  };
  it('yüzdeyi hesaplar', () => {
    expect(ratingBarPercent(s, 5)).toBe(50);
    expect(ratingBarPercent(s, 3)).toBe(25);
    expect(ratingBarPercent(s, 1)).toBe(0);
  });
  it('yorum yoksa 0', () => {
    expect(ratingBarPercent({ ...s, count: 0 }, 5)).toBe(0);
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-10-13T12:00:00Z').getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();
  it('birimleri seçer', () => {
    expect(timeAgo(ago(30_000), now)).toBe('şimdi');
    expect(timeAgo(ago(5 * 60_000), now)).toBe('5 dk önce');
    expect(timeAgo(ago(3 * 3600_000), now)).toBe('3 saat önce');
    expect(timeAgo(ago(3 * 86400_000), now)).toBe('3 gün önce');
    expect(timeAgo(ago(8 * 86400_000), now)).toBe('1 hafta önce');
    expect(timeAgo(ago(65 * 86400_000), now)).toBe('2 ay önce');
  });
});

describe('initials', () => {
  it('ad soyad baş harfleri (Türkçe büyük harf)', () => {
    expect(initials('Zeynep Tan')).toBe('ZT');
    expect(initials('ismail')).toBe('İ');
    expect(initials(null)).toBe('?');
  });
});

describe('directionsUrl', () => {
  it('platforma göre bağlantı', () => {
    expect(directionsUrl(41.1, 29.0, 'android')).toContain('destination=41.1,29');
    expect(directionsUrl(41.1, 29.0, 'ios')).toContain('daddr=41.1,29');
  });
});
