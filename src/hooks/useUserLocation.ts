import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';

import type { LngLat } from '@/lib/geo';

export type LocationStatus = 'loading' | 'granted' | 'denied';

type State = {
  status: LocationStatus;
  coords: LngLat | null;
  /** İzin penceresi tekrar gösterilebilir mi? (false ise ayarlara yönlendirilir) */
  canAskAgain: boolean;
};

/** Ön plan konum izni + tek seferlik mevcut konum. Canlı konum noktası haritanın kendi puck'ı. */
export function useUserLocation() {
  const [state, setState] = useState<State>({ status: 'loading', coords: null, canAskAgain: true });

  const resolve = useCallback(async (perm: Location.LocationPermissionResponse) => {
    if (!perm.granted) {
      setState({ status: 'denied', coords: null, canAskAgain: perm.canAskAgain });
      return;
    }
    try {
      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      setState({
        status: 'granted',
        coords: [pos.coords.longitude, pos.coords.latitude],
        canAskAgain: true,
      });
    } catch {
      // İzin var ama konum alınamadı (GPS kapalı vb.): izinli say, koordinat yok.
      setState({ status: 'granted', coords: null, canAskAgain: true });
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Location.getForegroundPermissionsAsync().then((perm) => {
      if (active) void resolve(perm);
    });
    return () => {
      active = false;
    };
  }, [resolve]);

  /** İzin iste; tekrar sorulamıyorsa cihaz ayarlarını aç. */
  const requestPermission = useCallback(async () => {
    if (!state.canAskAgain) {
      await Linking.openSettings();
      return;
    }
    await resolve(await Location.requestForegroundPermissionsAsync());
  }, [resolve, state.canAskAgain]);

  /** Ayarlardan dönünce izni yeniden oku. */
  const refresh = useCallback(async () => {
    await resolve(await Location.getForegroundPermissionsAsync());
  }, [resolve]);

  return { ...state, requestPermission, refresh };
}
