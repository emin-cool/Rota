import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeadlineLg, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';

/** Geçici iskelet — rota sihirbazı P1.3'te yapılacak. */
export default function WizardStep1Stub() {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1 gap-space-sm bg-canvas px-margin"
      style={{ paddingTop: insets.top + 16 }}
    >
      <HeadlineLg>{tr.routeStub.wizardTitle}</HeadlineLg>
      <Text className="text-ink-secondary">{tr.routeStub.comingSoon}</Text>
    </View>
  );
}
