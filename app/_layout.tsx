import '../global.css';

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ProfileGate } from '@/components/ProfileGate';
import { useSessionStore } from '@/stores/sessionStore';
import { fontAssets } from '@/theme/fonts';

void SplashScreen.preventAutoHideAsync();

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
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          {/* Giriş yapılmamış ya da onboarding bitmemiş → (auth) grubu */}
          <Stack.Protected guard={signedOut || !onboarded}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={!signedOut && onboarded}>
            <Stack.Screen name="(tabs)" />
          </Stack.Protected>
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
