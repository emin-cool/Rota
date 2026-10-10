import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, HeadlineMd, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { signOut } from '@/lib/auth';
import { useSessionStore } from '@/stores/sessionStore';

/** Oturum açık ama profil satırı alınamadığında gösterilen hata durumu. */
export function ProfileGate() {
  const insets = useSafeAreaInsets();
  const refreshProfile = useSessionStore((s) => s.refreshProfile);

  return (
    <View
      className="flex-1 justify-center gap-space-md bg-canvas px-margin"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <HeadlineMd>{tr.gate.profileErrorTitle}</HeadlineMd>
      <Text className="text-ink-secondary">{tr.gate.profileErrorBody}</Text>
      <Button title={tr.common.retry} onPress={() => void refreshProfile()} />
      <Button title={tr.common.signOut} variant="ghost" onPress={() => void signOut()} />
    </View>
  );
}
