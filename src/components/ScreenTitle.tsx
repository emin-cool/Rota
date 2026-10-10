import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeadlineLg } from '@/components/ui';

/** Geçici ekran iskeleti: sadece başlık gösterir. Gerçek içerik sonraki adımlarda gelecek. */
export function ScreenTitle({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-canvas px-margin" style={{ paddingTop: insets.top + 16 }}>
      <HeadlineLg>{title}</HeadlineLg>
    </View>
  );
}
