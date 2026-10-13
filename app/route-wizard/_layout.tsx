import { Stack } from 'expo-router';
import { colors } from '@/theme/tokens';

/** Rota sihirbazı: 6 adım + yükleme. Her adım kendi üst barını çizer. */
export default function WizardLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}
    />
  );
}
