import { Stack } from 'expo-router';

/** Rota sihirbazı: 6 adım + yükleme. Her adım kendi üst barını çizer. */
export default function WizardLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F7F8F6' } }} />
  );
}
