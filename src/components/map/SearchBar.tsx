import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { colors, shadows } from '@/theme/tokens';

/**
 * Arama çubuğu (görsel). Gerçek yer araması (Mapbox Geocoding) sonraki bir adımda
 * eklenecek; o zamana kadar etkileşimsiz durur ki kullanıcıyı yanıltmasın.
 */
export function SearchBar() {
  return (
    <View
      accessibilityRole="search"
      className="mx-margin h-12 flex-row items-center gap-space-sm rounded-full border border-hairline bg-white/90 px-space-md"
      style={shadows.level2}
    >
      <MaterialIcons name="search" size={22} color={colors.brand.DEFAULT} />
      <Text variant="body-lg" className="text-ink-muted">
        {tr.map.searchPlaceholder}
      </Text>
    </View>
  );
}
