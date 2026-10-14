import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import {
  isNewerThan,
  nextFeedCursor,
  normalizeComment,
  withKudos,
  type FeedFilter,
} from '@/lib/social';
import {
  acceptRequest,
  addComment,
  blockUser,
  COMMENTS_PAGE,
  deleteComment,
  FEED_PAGE,
  fetchActivity,
  fetchBlockedUsers,
  fetchComments,
  fetchFeed,
  fetchFollowList,
  fetchFollowRequests,
  fetchProfileCard,
  fetchSocialCounts,
  followUser,
  PEOPLE_PAGE,
  removeFollower,
  searchProfiles,
  setKudos,
  unblockUser,
  unfollowUser,
} from '@/lib/socialApi';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/sessionStore';
import type { FeedActivity } from '@/types/database';

const useMyId = () => useSessionStore((s) => s.session?.user.id);

/** Akış: takip ettiklerin + kendin, sonsuz kaydırma (imleç = son kartın created_at'i). */
export function useFeed(filter: FeedFilter) {
  const userId = useMyId();
  return useInfiniteQuery({
    queryKey: ['feed', userId, filter],
    enabled: !!userId,
    initialPageParam: null as string | null,
    staleTime: 20_000,
    queryFn: ({ pageParam }) =>
      fetchFeed({
        scope: 'following',
        activity: filter === 'all' ? null : filter,
        before: pageParam,
      }),
    getNextPageParam: (last) => nextFeedCursor(last, FEED_PAGE) ?? undefined,
  });
}

/** Bir kullanıcının görebildiğim aktiviteleri (profil sayfası). */
export function useUserActivities(targetId: string | undefined, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['feed', 'user', targetId],
    enabled: !!targetId && enabled,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchFeed({ scope: 'user', userId: targetId, before: pageParam }),
    getNextPageParam: (last) => nextFeedCursor(last, FEED_PAGE) ?? undefined,
  });
}

export function useActivity(id: string | undefined) {
  return useQuery({
    queryKey: ['activity', id],
    enabled: !!id,
    queryFn: () => fetchActivity(id!),
  });
}

export function useComments(activityId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['comments', activityId],
    enabled: !!activityId,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchComments(activityId!, pageParam),
    getNextPageParam: (last, all) =>
      last.length >= COMMENTS_PAGE ? all.reduce((n, p) => n + p.length, 0) : undefined,
  });
}

export function useProfileCard(targetId: string | undefined) {
  return useQuery({
    queryKey: ['profile-card', targetId],
    enabled: !!targetId,
    queryFn: () => fetchProfileCard(targetId!),
  });
}

export function useSocialCounts() {
  const userId = useMyId();
  return useQuery({
    queryKey: ['social-counts', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: fetchSocialCounts,
  });
}

export function useFollowList(userId: string | undefined, kind: 'followers' | 'following') {
  return useInfiniteQuery({
    queryKey: ['follow-list', userId, kind],
    enabled: !!userId,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchFollowList(userId!, kind, pageParam),
    getNextPageParam: (last, all) =>
      last.length >= PEOPLE_PAGE ? all.reduce((n, p) => n + p.length, 0) : undefined,
  });
}

export function useFollowRequests() {
  const userId = useMyId();
  return useInfiniteQuery({
    queryKey: ['follow-requests', userId],
    enabled: !!userId,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchFollowRequests(pageParam),
    getNextPageParam: (last, all) =>
      last.length >= PEOPLE_PAGE ? all.reduce((n, p) => n + p.length, 0) : undefined,
  });
}

/** Arama kutusu: yazmayı bırakınca (350 ms) en az 2 karakterle sorgular. */
export function useSearchPeople(text: string) {
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);
  return useQuery({
    queryKey: ['people-search', debounced],
    enabled: debounced.length >= 2,
    staleTime: 30_000,
    queryFn: () => searchProfiles(debounced),
  });
}

/** Alkış: ekranda hemen değişir (akış, detay), sunucu hata verirse geri alınır. */
export function useToggleKudos() {
  const qc = useQueryClient();
  const userId = useMyId();

  const patch = (activityId: string, on: boolean) => {
    qc.setQueriesData<InfiniteData<FeedActivity[]>>(
      { queryKey: ['feed'] },
      (old) =>
        old && {
          ...old,
          pages: old.pages.map((page) =>
            page.map((a) => (a.id === activityId ? withKudos(a, on) : a)),
          ),
        },
    );
    qc.setQueryData<FeedActivity | null>(['activity', activityId], (old) =>
      old ? withKudos(old, on) : old,
    );
  };

  return useMutation({
    mutationFn: async (v: { activityId: string; on: boolean }) => {
      if (!userId) throw new Error('no-session');
      await setKudos(userId, v.activityId, v.on);
    },
    onMutate: (v) => patch(v.activityId, v.on),
    onError: (_e, v) => patch(v.activityId, !v.on),
  });
}

export function useAddComment(activityId: string) {
  const qc = useQueryClient();
  const userId = useMyId();
  return useMutation({
    mutationFn: async (raw: string) => {
      const body = normalizeComment(raw);
      if (!userId || !body) throw new Error('invalid');
      await addComment(userId, activityId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['comments', activityId] });
      void qc.invalidateQueries({ queryKey: ['activity', activityId] });
      void qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useDeleteComment(activityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['comments', activityId] });
      void qc.invalidateQueries({ queryKey: ['activity', activityId] });
      void qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export type FollowOp = 'follow' | 'unfollow' | 'cancel' | 'accept' | 'decline' | 'remove';

/** Takip işlemleri: sonrasında ilgili tüm sosyal sorgular tazelenir (durum sunucudan gelir). */
export function useFollowOp() {
  const qc = useQueryClient();
  const userId = useMyId();
  return useMutation({
    mutationFn: async (v: { op: FollowOp; targetId: string }) => {
      if (!userId) throw new Error('no-session');
      switch (v.op) {
        case 'follow':
          return followUser(userId, v.targetId);
        case 'unfollow':
        case 'cancel':
          return unfollowUser(userId, v.targetId);
        case 'accept':
          return acceptRequest(userId, v.targetId);
        case 'decline':
        case 'remove':
          return removeFollower(userId, v.targetId);
      }
    },
    onSuccess: () => {
      for (const key of [
        'profile-card',
        'follow-list',
        'follow-requests',
        'social-counts',
        'people-search',
        'feed',
      ]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

/**
 * "Yeni gönderiler": Realtime ile activities INSERT'lerini dinler (RLS abone için geçerli: yalnızca
 * görebildiğim aktiviteler gelir). Olay gelince akışın ilk sayfası çekilip gösterilenden yeni olanlar
 * sayılır; böylece yabancıların herkese açık aktiviteleri sayacı şişirmez. Realtime düşerse
 * aşağı çekip yenilemek yedek yoldur.
 */
export function useNewPosts(newestSeen: string | null) {
  const userId = useMyId();
  const [count, setCount] = useState(0);
  const seenRef = useRef(newestSeen);
  useEffect(() => {
    seenRef.current = newestSeen;
  }, [newestSeen]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('feed-activities')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activities' },
        (payload) => {
          const owner = (payload.new as { user_id?: string }).user_id;
          if (!owner || owner === userId) return;
          void fetchFeed({ scope: 'following' })
            .then((page) =>
              setCount(page.filter((a) => isNewerThan(a.created_at, seenRef.current)).length),
            )
            .catch(() => undefined);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return { count, reset: () => setCount(0) };
}

export function useBlockedUsers() {
  const userId = useMyId();
  return useQuery({
    queryKey: ['blocked-users', userId],
    enabled: !!userId,
    gcTime: 0,
    queryFn: fetchBlockedUsers,
  });
}

/** Engelle / engeli kaldır: sonrasında içerik içeren tüm sosyal sorgular tazelenir. */
export function useBlockOp() {
  const qc = useQueryClient();
  const userId = useMyId();
  return useMutation({
    mutationFn: async (v: { op: 'block' | 'unblock'; targetId: string }) => {
      if (!userId) throw new Error('no-session');
      if (v.op === 'block') await blockUser(userId, v.targetId);
      else await unblockUser(userId, v.targetId);
    },
    onSuccess: () => {
      for (const key of [
        'feed',
        'activity',
        'comments',
        'profile-card',
        'follow-list',
        'follow-requests',
        'social-counts',
        'people-search',
        'blocked-users',
        'route-reviews',
      ]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
