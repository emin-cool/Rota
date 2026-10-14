import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import {
  configureNotificationHandler,
  ensurePushRegistered,
  getPushPermission,
  isPushSupported,
  registerPushToken,
} from '@/lib/push';
import { parsePushTarget, type PushTarget } from '@/lib/pushTarget';

function open(target: PushTarget) {
  switch (target.screen) {
    case 'user':
      router.push({ pathname: '/user/[id]', params: { id: target.userId } });
      break;
    case 'activity':
      router.push({ pathname: '/activity/[id]', params: { id: target.activityId } });
      break;
    case 'follow-requests':
      router.push('/follow-requests');
      break;
  }
}

/**
 * Oturum açık ve onboarding bitmişken (`active`): izin zaten verilmişse token'ı tazeler, bildirime dokunmayı
 * ilgili ekrana yönlendirir (uygulama kapalıyken açılış dahil). İzin İSTEMEZ; bağlamında `maybeAskForPush` sorar.
 */
export function usePushNotifications(active: boolean) {
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!active || !isPushSupported()) return;
    configureNotificationHandler();
    void getPushPermission().then((p) => {
      if (p === 'granted') void registerPushToken();
    });

    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handled.current === id) return; // aynı dokunuşu iki kez işleme
      handled.current = id;
      const target = parsePushTarget(response.notification.request.content.data);
      if (target) open(target);
    };

    // Ayarlardan izin sonradan verildiyse, uygulamaya dönünce token'ı kaydet.
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') void ensurePushRegistered();
    });

    // Uygulama bildirimle (kapalıyken) açıldıysa.
    handle(Notifications.getLastNotificationResponse());
    // Uygulama açıkken ya da arka plandayken dokunulursa.
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => {
      sub.remove();
      appState.remove();
    };
  }, [active]);
}
