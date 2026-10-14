// Push bildirimi izni, token kaydı ve ayarlar (istemci). Gönderim sunucuda: supabase/functions/send-push.
// Push yalnızca gerçek cihazda ve native build'de çalışır (Expo Go / simülatör / web'de sessizce atlanır).
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';

import { tr } from '@/i18n/tr';
import { reportError } from '@/lib/monitoring';
import { supabase } from '@/lib/supabase';
import { getSetting, setSetting } from '@/lib/trackingDb';
import type { NotificationSettingsRow, NotificationSettingsUpdate } from '@/types/database';

export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

const SETTING_PUSH_TOKEN = 'push_token';
const SETTING_PUSH_ASKED = 'push_asked';
const ANDROID_CHANNEL = 'default';

/** Bu cihazda push kullanılabilir mi (gerçek telefon, iOS/Android)? */
export const isPushSupported = () => Platform.OS !== 'web' && Device.isDevice;

/** Uygulama açıkken gelen bildirim banner olarak görünsün (ses ve rozet yok). */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function getPushPermission(): Promise<PushPermission> {
  if (!isPushSupported()) return 'unavailable';
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

/** İzin verilmişse Expo push token'ını alıp sunucuya yazar. İzin istemez. */
export async function registerPushToken(): Promise<void> {
  if ((await getPushPermission()) !== 'granted') return;
  try {
    if (Platform.OS === 'android') {
      // Android 8+: bildirim kanalı token'dan önce var olmalı.
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: 'Genel',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const projectId =
      (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ??
      Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    if (error) throw error;
    await setSetting(SETTING_PUSH_TOKEN, token);
  } catch (e) {
    // Token alınamaması (ör. FCM yapılandırılmamış) uygulamayı bozmaz; yalnızca raporlanır.
    reportError(e, 'registerPushToken');
  }
}

/** Sistem izin penceresini açar; verilirse token'ı kaydeder. */
export async function requestPushPermission(): Promise<PushPermission> {
  if (!isPushSupported()) return 'unavailable';
  await Notifications.requestPermissionsAsync();
  await registerPushToken();
  return getPushPermission();
}

/** Çıkış yaparken bu cihazın token'ını sunucudan siler (oturum açıkken çağır). */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await getSetting(SETTING_PUSH_TOKEN);
    if (!token) return;
    await supabase.from('push_tokens').delete().eq('token', token);
    await setSetting(SETTING_PUSH_TOKEN, '');
  } catch (e) {
    reportError(e, 'unregisterPushToken');
  }
}

/**
 * Bağlamında (ilk takip, ilk aktivite kaydı) bir kez, kendi açıklamamızla sor; sistem izin penceresi
 * yalnızca "İzin ver"e basılırsa açılır. İzin zaten verildiyse yalnızca token'ı tazeler.
 */
export async function maybeAskForPush(): Promise<void> {
  try {
    const permission = await getPushPermission();
    if (permission === 'granted') {
      await registerPushToken();
      return;
    }
    if (permission !== 'undetermined') return;
    if ((await getSetting(SETTING_PUSH_ASKED)) === '1') return;
    await setSetting(SETTING_PUSH_ASKED, '1');
    Alert.alert(tr.push.askTitle, tr.push.askBody, [
      { text: tr.push.askLater, style: 'cancel' },
      { text: tr.push.askAllow, onPress: () => void requestPushPermission() },
    ]);
  } catch (e) {
    reportError(e, 'maybeAskForPush');
  }
}

// ---------------------------------------------------------------- bildirim tercihleri

export const DEFAULT_NOTIFICATION_SETTINGS = {
  follows: true,
  kudos: true,
  comments: true,
} as const;

export async function fetchNotificationSettings(
  userId: string,
): Promise<Pick<NotificationSettingsRow, 'follows' | 'kudos' | 'comments'>> {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('follows, kudos, comments')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? { ...DEFAULT_NOTIFICATION_SETTINGS };
}

export async function saveNotificationSettings(
  userId: string,
  patch: NotificationSettingsUpdate,
): Promise<void> {
  const { error } = await supabase
    .from('notification_settings')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' });
  if (error) throw error;
}
