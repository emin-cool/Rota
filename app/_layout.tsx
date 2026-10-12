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
// Arka plan konum görevi modül yüklenirken tanımlanmak zorundadır.
import '@/lib/trackingTask';
import { useSessionStore } from '@/stores/sessionStore';
import { fontAssets } from '@/theme/fonts';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const initialized = useSessionStore((s) => s.initialized);
  const session = useSessionStore((s) => s.session);
  const profile = useSessionStore((s) => s.profile);
  const init = useSessionStore((s) => s.init);

  useEffect(() => init(), [init]);

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
              <Stack.Screen name="route-wizard" />
              <Stack.Screen name="route-results" />
              <Stack.Screen name="activity/live" />
              <Stack.Screen name="activity/summary" />
            </Stack.Protected>
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
