import { filtersToArgs, nextOffset, type ExploreFilters } from '@/lib/explore';
import { supabase } from '@/lib/supabase';
import type {
  ExploreRoute,
  PoiSummary,
  RatingSummary,
  ReviewListItem,
  RouteDetail,
} from '@/types/database';

export type ExplorePage = { items: ExploreRoute[]; next: number | undefined };

export async function fetchExplorePage(
  filters: ExploreFilters,
  offset: number,
  opts: { featuredOnly?: boolean; limit?: number; scope?: 'public' | 'mine' | 'saved' } = {},
): Promise<ExplorePage> {
  const { data, error } = await supabase.rpc(
    'explore_routes',
    filtersToArgs(filters, {
      p_offset: offset,
      p_featured_only: opts.featuredOnly ?? false,
      p_sort: opts.featuredOnly
        ? 'featured'
        : opts.scope && opts.scope !== 'public'
          ? 'newest'
          : 'popular',
      p_scope: opts.scope ?? 'public',
      ...(opts.limit ? { p_limit: opts.limit } : {}),
    }),
  );
  if (error) throw error;
  const items = data ?? [];
  return { items, next: nextOffset(items.length, offset + items.length) };
}

export async function fetchDistricts(): Promise<string[]> {
  const { data, error } = await supabase.rpc('route_districts');
  if (error) throw error;
  return data ?? [];
}

export async function fetchRouteDetail(id: string): Promise<RouteDetail | null> {
  const { data, error } = await supabase.rpc('route_detail', { p_id: id });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function fetchRatingSummary(id: string): Promise<RatingSummary> {
  const { data, error } = await supabase.rpc('route_rating_summary', { p_id: id });
  if (error) throw error;
  return data;
}

export const REVIEWS_PAGE = 5;

export async function fetchReviews(id: string, offset: number): Promise<ReviewListItem[]> {
  const { data, error } = await supabase.rpc('route_reviews_list', {
    p_id: id,
    p_limit: REVIEWS_PAGE,
    p_offset: offset,
  });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPois(id: string): Promise<PoiSummary[]> {
  const { data, error } = await supabase.rpc('route_pois', { p_id: id });
  if (error) throw error;
  return data ?? [];
}

/** Kaydet / kaydı kaldır (kalp ve yer imi). */
export async function setRouteSaved(
  userId: string,
  routeId: string,
  saved: boolean,
): Promise<void> {
  if (saved) {
    const { error } = await supabase
      .from('saved_routes')
      .insert({ user_id: userId, route_id: routeId });
    // Zaten kayıtlıysa (23505) sorun yok.
    if (error && error.code !== '23505') throw error;
  } else {
    const { error } = await supabase
      .from('saved_routes')
      .delete()
      .eq('user_id', userId)
      .eq('route_id', routeId);
    if (error) throw error;
  }
}

/** Kullanıcının bu rotadaki en son aktivitesi; yoksa null → yorum yazamaz. */
export async function fetchMyLatestActivity(
  userId: string,
  routeId: string,
): Promise<{ started_at: string; distance_m: number } | null> {
  const { data, error } = await supabase
    .from('activities')
    .select('started_at, distance_m')
    .eq('user_id', userId)
    .eq('route_id', routeId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMyReview(
  userId: string,
  routeId: string,
): Promise<{ rating: number; comment: string | null; tags: string[] } | null> {
  const { data, error } = await supabase
    .from('route_reviews')
    .select('rating, comment, tags')
    .eq('user_id', userId)
    .eq('route_id', routeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMyPhotoCount(userId: string, routeId: string): Promise<number> {
  const { count, error } = await supabase
    .from('route_photos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('route_id', routeId);
  if (error) throw error;
  return count ?? 0;
}
