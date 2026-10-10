import { Stack } from 'expo-router';

import { useSessionStore } from '@/stores/sessionStore';

export default function AuthLayout() {
  const session = useSessionStore((s) => s.session);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F7F8F6' } }}>
      {/* Çıkış yapmış kullanıcı: karşılama ve giriş */}
      <Stack.Protected guard={!session}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
      </Stack.Protected>
      {/* Giriş yapmış ama onboarding'i bitirmemiş kullanıcı */}
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="location" />
      </Stack.Protected>
    </Stack>
  );
}
