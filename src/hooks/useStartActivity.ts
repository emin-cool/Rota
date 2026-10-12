import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { tr } from '@/i18n/tr';
import type { LngLat } from '@/lib/geo';
import { ActiveSessionError, trackingEngine } from '@/lib/trackingEngine';
import { ensureTrackingPermission } from '@/lib/trackingLocation';
import type { ActivityType } from '@/types/routes';

type StartParams = {
  activityType: ActivityType;
  /** Planlı rota; serbest kayıtta yok. */
  route?: LngLat[] | null;
  routeTitle?: string | null;
  /** Planlı rotanın `routes.id`'si (özet ekranında puanlama ve fotoğraf için). */
  routeId?: string | null;
};

/** İzin ister, motoru başlatır, canlı ekrana geçer. İzin yoksa açıklayıcı uyarı gösterip false döner. */
async function begin(params: StartParams): Promise<void> {
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
}

/** Beklenmeyen başlatma hatasını gösterir (geliştirmede gerçek sebep, üretimde genel mesaj). */
function showStartError(e: unknown) {
  const detail = e instanceof Error ? e.message : String(e);
  console.warn('[tracking] kayıt başlatılamadı:', detail);
  Alert.alert(tr.live.errors.startFailed, __DEV__ ? detail : undefined);
}

/**
 * Kaydı başlatır: konum izni → motoru başlat → canlı ekrana geç. Verisi olan bir kayıt zaten
 * sürüyorsa kaybetmeden seçenek sunar (kayda dön / sil ve yenisini başlat).
 */
export function useStartActivity() {
  const [starting, setStarting] = useState(false);

  const start = useCallback(
    async (params: StartParams) => {
      if (starting) return;
      setStarting(true);
      try {
        await begin(params);
      } catch (e) {
        if (e instanceof ActiveSessionError) {
          Alert.alert(tr.record.openTitle, tr.record.openBody2, [
            { text: tr.record.cancel, style: 'cancel' },
            { text: tr.record.resume, onPress: () => router.push('/activity/live') },
            {
              text: tr.record.discardAndStart,
              style: 'destructive',
              onPress: () => {
                void (async () => {
                  try {
                    await trackingEngine.discard();
                    await begin(params);
                  } catch (err) {
                    showStartError(err);
                  }
                })();
              },
            },
          ]);
        } else {
          showStartError(e);
        }
      } finally {
        setStarting(false);
      }
    },
    [starting],
  );

  return { start, starting };
}
