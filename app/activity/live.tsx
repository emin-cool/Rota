import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, HeadlineLg, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';

/** Geçici iskelet — canlı aktivite takibi P1.4'te yapılacak ("Başla" butonu buraya gelir). */
export default function LiveActivityStub() {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1 justify-center gap-space-md bg-canvas px-margin"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <HeadlineLg>{tr.tabs.record}</HeadlineLg>
      <Text className="text-ink-secondary">{tr.results.liveSoon}</Text>
      <Button title={tr.wizard.back} variant="secondary" onPress={() => router.back()} />
    </View>
  );
}
