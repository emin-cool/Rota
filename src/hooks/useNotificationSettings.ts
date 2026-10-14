import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  DEFAULT_NOTIFICATION_SETTINGS,
  fetchNotificationSettings,
  getPushPermission,
  requestPushPermission,
  saveNotificationSettings,
  type PushPermission,
} from '@/lib/push';
import { useSessionStore } from '@/stores/sessionStore';
import type { NotificationSettingsUpdate } from '@/types/database';

/** Bildirim tercihleri (takip / alkış / yorum). Anahtar değişince hemen yansır, hata olursa geri alınır. */
export function useNotificationSettings() {
  const userId = useSessionStore((s) => s.session?.user.id);
  const qc = useQueryClient();
  const key = ['notification-settings', userId];

  const query = useQuery({
    queryKey: key,
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: () => fetchNotificationSettings(userId!),
  });

  const mutation = useMutation({
    mutationFn: (patch: NotificationSettingsUpdate) => saveNotificationSettings(userId!, patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<typeof DEFAULT_NOTIFICATION_SETTINGS>(key);
      qc.setQueryData(key, { ...(prev ?? DEFAULT_NOTIFICATION_SETTINGS), ...patch });
      return { prev };
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });

  return { query, mutation };
}

/** Sistem bildirim izni; uygulamaya dönünce (ayarlardan izin verilmiş olabilir) tazelenir. */
export function usePushPermission() {
  const [permission, setPermission] = useState<PushPermission | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void getPushPermission().then((p) => {
        if (alive) setPermission(p);
      });
    };
    refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const request = useCallback(async () => setPermission(await requestPushPermission()), []);

  return { permission, request };
}
