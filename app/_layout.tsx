import '../global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ProfileGate } from '@/components/ProfileGate';
import { ModerationSheet } from '@/components/social/ModerationSheet';
// Arka plan konum görevi modül yüklenirken tanımlanmak zorundadır.
import '@/lib/trackingTask';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import { initMonitoring, setMonitoringUser, wrapRoot } from '@/lib/monitoring';
import { useSessionStore } from '@/stores/sessionStore';
import { fontAssets } from '@/theme/fonts';

initMonitoring();
void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const initialized = useSessionStore((s) => s.initialized);
  const session = useSessionStore((s) => s.session);
  const profile = useSessionStore((s) => s.profile);
  const init = useSessionStore((s) => s.init);

  useEffect(() => init(), [init]);
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  useEffect(() => setMonitoringUser(userId), [userId]);
  useUploadQueue();
  usePushNotifications(!!session && !!profile?.onboarding_completed);

  const ready = (fontsLoaded || !!fontError) && initialized;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Font + ilk oturum kontrolü bitene kadar splash görünür (font hatasında sistem fontuyla açılır).
  if (!ready) return null;

  // Oturum var ama profil yüklenemedi → hata/yeniden dene ekranı.
  if (session && !profile) {
    return (
      <SafeAreaProvider>
        <ProfileGate />
      </SafeAreaProvider>
    );
  }

  const signedOut = !session;
  const onboarded = !!profile?.onboarding_completed;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            {/* Giriş yapılmamış ya da onboarding bitmemiş → (auth) grubu */}
            <Stack.Protected guard={signedOut || !onboarded}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
            <Stack.Protected guard={!signedOut && onboarded}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="route/[id]/index" />
              <Stack.Screen name="route/[id]/review" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="profile-edit" />
              <Stack.Screen name="privacy-zone" />
              <Stack.Screen name="activity/[id]" />
              <Stack.Screen name="user/[id]" />
              <Stack.Screen name="people" />
              <Stack.Screen name="follow-list" />
              <Stack.Screen name="follow-requests" />
              <Stack.Screen name="blocked-users" />
              <Stack.Screen name="route-wizard" />
              <Stack.Screen name="route-results" />
              <Stack.Screen name="activity/live" />
              <Stack.Screen name="activity/summary" />
            </Stack.Protected>
          </Stack>
          <ModerationSheet />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default wrapRoot(RootLayout);
