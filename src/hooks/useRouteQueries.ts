import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type { ExploreFilters } from '@/lib/explore';
import {
  type ExplorePage,
  fetchDistricts,
  fetchExplorePage,
  fetchPois,
  fetchRatingSummary,
  fetchReviews,
  fetchRouteDetail,
  REVIEWS_PAGE,
  setRouteSaved,
} from '@/lib/exploreApi';
import { useSessionStore } from '@/stores/sessionStore';
import type { RouteDetail } from '@/types/database';

/** Keşfet ana listesi (popüler ya da filtreli), sonsuz kaydırma. */
export function useExploreRoutes(filters: ExploreFilters) {
  return useInfiniteQuery({
    queryKey: ['explore', filters],
    initialPageParam: 0,
    staleTime: 30_000,
    queryFn: ({ pageParam }) => fetchExplorePage(filters, pageParam),
    getNextPageParam: (last) => last.next,
  });
}

/** "Editörün seçtikleri": filtre yokken tek sayfa. */
export function useFeaturedRoutes(enabled: boolean) {
  return useQuery({
    queryKey: ['featured'],
    enabled,
    staleTime: 60_000,
    queryFn: () =>
      fetchExplorePage(
        {
          query: '',
          activity: null,
          duration: null,
          difficulty: null,
          district: null,
          topRated: false,
        },
        0,
        { featuredOnly: true, limit: 10 },
      ),
  });
}

export function useDistricts() {
  return useQuery({ queryKey: ['districts'], staleTime: 10 * 60_000, queryFn: fetchDistricts });
}

export function useRouteDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['route-detail', id],
    enabled: !!id,
    queryFn: () => fetchRouteDetail(id!),
  });
}

export function useRatingSummary(id: string | undefined) {
  return useQuery({
    queryKey: ['route-rating', id],
    enabled: !!id,
    queryFn: () => fetchRatingSummary(id!),
  });
}

export function usePois(id: string | undefined) {
  return useQuery({
    queryKey: ['route-pois', id],
    enabled: !!id,
    staleTime: 10 * 60_000,
    queryFn: () => fetchPois(id!),
  });
}

export function useRouteReviews(id: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['route-reviews', id],
    enabled: !!id,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchReviews(id!, pageParam),
    getNextPageParam: (last, all) =>
      last.length >= REVIEWS_PAGE ? all.reduce((n, p) => n + p.length, 0) : undefined,
  });
}

/** Kalp/yer imi: önce ekranda hemen değişir, sunucu hata verirse geri alınır. */
export function useToggleSaved() {
  const qc = useQueryClient();
  const userId = useSessionStore((s) => s.session?.user.id);

  const patch = (routeId: string, saved: boolean) => {
    const patchPages = (old: InfiniteData<ExplorePage> | undefined) =>
      old && {
        ...old,
        pages: old.pages.map((p) => ({
          ...p,
          items: p.items.map((r) => (r.id === routeId ? { ...r, saved } : r)),
        })),
      };
    qc.setQueriesData<InfiniteData<ExplorePage>>({ queryKey: ['explore'] }, patchPages);
    qc.setQueryData<ExplorePage>(
      ['featured'],
      (old) =>
        old && { ...old, items: old.items.map((r) => (r.id === routeId ? { ...r, saved } : r)) },
    );
    qc.setQueryData<RouteDetail | null>(['route-detail', routeId], (old) =>
      old ? { ...old, saved } : old,
    );
  };

  return useMutation({
    mutationFn: async (v: { routeId: string; saved: boolean }) => {
      if (!userId) throw new Error('no-session');
      await setRouteSaved(userId, v.routeId, v.saved);
    },
    onMutate: (v) => patch(v.routeId, v.saved),
    onError: (_e, v) => patch(v.routeId, !v.saved),
    // Kaydedilenler listesi sunucudan yenilensin (kaldırılan rota listeden çıksın).
    onSettled: () => qc.invalidateQueries({ queryKey: ['explore', 'scope', 'saved'] }),
  });
}
