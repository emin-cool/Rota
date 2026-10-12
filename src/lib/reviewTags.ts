import type { MaterialIcons } from '@expo/vector-icons';

/**
 * Yorum etiketleri (Stitch "Yorum Yaz"). Veritabanında etiketin Türkçe metni saklanır
 * (route_reviews.tags), bu yüzden metinleri sonradan değiştirme; yeni etiket ekle.
 */
export const REVIEW_TAGS: { label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { label: 'Manzara harika', icon: 'landscape' },
  { label: 'Düz ve rahat zemin', icon: 'alt-route' },
  { label: 'Gölge alan bol', icon: 'forest' },
  { label: 'Çeşme/Su noktası', icon: 'water-drop' },
  { label: 'Köpek dostu', icon: 'pets' },
  { label: 'Bebek arabasına uygun', icon: 'stroller' },
  { label: 'Işıklandırma iyi', icon: 'wb-twilight' },
  { label: 'Yoğun/Kalabalık', icon: 'groups' },
];

export const MAX_COMMENT = 500;
