import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';

/** Salt okunur yıldız satırı (yarım yıldız dahil). */
export function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <View
      className="flex-row"
      accessibilityRole="image"
      accessibilityLabel={`${rating.toFixed(1).replace('.', ',')} yıldız`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <MaterialIcons
          key={n}
          name={rating >= n - 0.25 ? 'star' : rating >= n - 0.75 ? 'star-half' : 'star-border'}
          size={size}
          color="#F59E0B"
        />
      ))}
    </View>
  );
}
