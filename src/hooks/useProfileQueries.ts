import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { EMPTY_FILTERS } from '@/lib/explore';
import { fetchExplorePage } from '@/lib/exploreApi';
import {
  ACTIVITIES_PAGE,
  fetchMyActivities,
  fetchMyStats,
  fetchPrivacyZone,
  fetchWeekly,
} from '@/lib/profileApi';
import { useSessionStore } from '@/stores/sessionStore';

export function useMyStats() {
  const userId = useSessionStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['my-stats', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: fetchMyStats,
  });
}

export function useWeekly() {
  const userId = useSessionStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['my-weekly', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: fetchWeekly,
  });
}

export function useMyActivities(enabled: boolean) {
  const userId = useSessionStore((s) => s.session?.user.id);
  return useInfiniteQuery({
    queryKey: ['my-activities', userId],
    enabled: enabled && !!userId,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchMyActivities(userId!, pageParam),
    getNextPageParam: (last, all) =>
      last.length >= ACTIVITIES_PAGE ? all.reduce((n, p) => n + p.length, 0) : undefined,
  });
}

/** "Rotalarım" ve "Kaydedilenler": Keşfet ile aynı kart ve sayfalama. */
export function useScopedRoutes(scope: 'mine' | 'saved', enabled: boolean) {
  const userId = useSessionStore((s) => s.session?.user.id);
  return useInfiniteQuery({
    // 'explore' önekiyle başladığı için kalp (kaydet) güncellemesi bu listeleri de kapsar.
    queryKey: ['explore', 'scope', scope, userId],
    enabled: enabled && !!userId,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchExplorePage(EMPTY_FILTERS, pageParam, { scope }),
    getNextPageParam: (last) => last.next,
  });
}

export function usePrivacyZone() {
  const userId = useSessionStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['privacy-zone', userId],
    enabled: !!userId,
    gcTime: 0,
    queryFn: fetchPrivacyZone,
  });
}
