import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeadlineLg, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';

/** Geçici iskelet — gerçek rota detayı P1.6'da yapılacak. */
export default function RouteDetailStub() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1 gap-space-sm bg-canvas px-margin"
      style={{ paddingTop: insets.top + 16 }}
    >
      <HeadlineLg>{tr.routeStub.detailTitle}</HeadlineLg>
      <Text className="text-ink-secondary">{id}</Text>
      <Text className="text-ink-secondary">{tr.routeStub.comingSoon}</Text>
    </View>
  );
}
