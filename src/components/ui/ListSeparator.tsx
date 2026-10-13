import { View } from 'react-native';

/** Liste öğeleri arası boşluk. Modül düzeyinde tanımlı: FlatList her render'da yeni bileşen görmesin. */
export function ListSeparator() {
  return <View className="h-space-md" />;
}
