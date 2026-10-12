import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { tr } from '@/i18n/tr';
import type { LngLat } from '@/lib/geo';
import { trackingEngine } from '@/lib/trackingEngine';
import { ensureTrackingPermission } from '@/lib/trackingLocation';
import type { ActivityType } from '@/types/routes';

type StartParams = {
  activityType: ActivityType;
  /** Planlı rota; serbest kayıtta yok. */
  route?: LngLat[] | null;
  routeTitle?: string | null;
};

/**
 * Kaydı başlatır: konum izni → motoru başlat → canlı ekrana geç. İzin yoksa açıklayıcı bir uyarı
 * (kalıcı reddedildiyse ayarlara yönlendiren) gösterir.
 */
export function useStartActivity() {
  const [starting, setStarting] = useState(false);

  const start = useCallback(
    async (params: StartParams) => {
      if (starting) return;
      setStarting(true);
      try {
        const perm = await ensureTrackingPermission();
        if (perm !== 'granted') {
          const e = tr.live.errors;
          Alert.alert(
            e.permissionTitle,
            perm === 'blocked' ? e.permissionBlocked : e.permissionBody,
            perm === 'blocked'
              ? [
                  { text: tr.record.cancel, style: 'cancel' },
                  { text: e.openSettings, onPress: () => void Linking.openSettings() },
                ]
              : [{ text: 'Tamam' }],
          );
          return;
        }
        await trackingEngine.start(params);
        router.push('/activity/live');
      } catch {
        Alert.alert(tr.live.errors.startFailed);
      } finally {
        setStarting(false);
      }
    },
    [starting],
  );

  return { start, starting };
}
