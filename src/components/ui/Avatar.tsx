import { Image, View } from 'react-native';

import { initials } from '@/lib/explore';

import { Text } from './Text';

/** Yuvarlak avatar: görsel varsa görsel, yoksa ad baş harfleri. */
export function Avatar({
  name,
  uri,
  size = 40,
}: {
  name: string | null;
  uri?: string | null;
  size?: number;
}) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image source={{ uri }} style={box} accessibilityIgnoresInvertColors />;
  return (
    <View className="items-center justify-center bg-brand-soft" style={box}>
      <Text variant="body-md" className="font-bold text-brand">
        {initials(name)}
      </Text>
    </View>
  );
}
