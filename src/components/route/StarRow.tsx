import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { tr } from '@/i18n/tr';
import { colors } from '@/theme/tokens';

/** Salt okunur yıldız satırı (yarım yıldız dahil). */
export function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <View
      className="flex-row"
      accessibilityRole="image"
      accessibilityLabel={tr.common.stars(rating.toFixed(1).replace('.', ','))}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <MaterialIcons
          key={n}
          name={rating >= n - 0.25 ? 'star' : rating >= n - 0.75 ? 'star-half' : 'star-border'}
          size={size}
          color={colors.star}
        />
      ))}
    </View>
  );
}
