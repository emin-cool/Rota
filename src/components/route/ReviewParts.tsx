import { MaterialIcons } from '@expo/vector-icons';
import { memo } from 'react';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, View } from 'react-native';

import { Avatar, Card, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { ratingBarPercent, timeAgo } from '@/lib/explore';
import { formatRating } from '@/lib/geo';
import { colors } from '@/theme/tokens';
import type { RatingSummary, ReviewListItem } from '@/types/database';

import { StarRow } from './StarRow';

/** Puan özeti: büyük ortalama, 5 çubuklu dağılım ve en çok kullanılan etiketler. */
export function RatingSummaryCard({ summary }: { summary: RatingSummary }) {
  return (
    <Card className="gap-space-md p-space-md">
      <View className="flex-row items-center gap-space-lg">
        <View className="items-center gap-1">
          <Text variant="display-hero" className="text-brand">
            {formatRating(summary.avg)}
          </Text>
          <StarRow rating={summary.avg} size={16} />
          <Text variant="label-sm" className="text-ink-secondary">
            {tr.detail.ratingOutOf}
          </Text>
        </View>
        <View className="flex-1 gap-1.5">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const pct = ratingBarPercent(summary, star);
            return (
              <View key={star} className="flex-row items-center gap-space-sm">
                <Text variant="label-sm" className="w-3 text-ink-secondary">
                  {star}
                </Text>
                <View className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container">
                  <View className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} />
                </View>
                <Text variant="label-sm" className="w-9 text-right text-ink-secondary">
                  %{pct}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      {summary.tags.length > 0 ? (
        <View className="flex-row flex-wrap gap-space-sm">
          {summary.tags.map((t) => (
            <View key={t.tag} className="rounded-full bg-surface-container px-3 py-1.5">
              <Text variant="label-sm" className="text-ink-secondary">
                {t.tag}{' '}
                <Text variant="label-sm" className="font-bold">
                  {t.count}
                </Text>
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/** Tek yorum: yorumcu, puan, doğrulanmış rozeti, metin, fotoğraflar. */
export const ReviewItem = memo(function ReviewItem({ review }: { review: ReviewListItem }) {
  return (
    <Card className="gap-space-sm p-space-md">
      <View className="flex-row items-center gap-space-md">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={review.display_name ?? ''}
          disabled={review.mine}
          onPress={() => router.push({ pathname: '/user/[id]', params: { id: review.user_id } })}
        >
          <Avatar name={review.display_name} uri={review.avatar_url} size={40} />
        </Pressable>
        <View className="flex-1">
          <Text variant="body-md" className="font-bold" numberOfLines={1}>
            {review.mine ? tr.detail.mine : (review.display_name ?? '—')}
          </Text>
          {review.is_verified ? (
            <View className="flex-row items-center gap-1">
              <MaterialIcons name="verified" size={14} color={colors.brand.DEFAULT} />
              <Text variant="label-sm" className="text-brand">
                {tr.detail.verified}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="label-sm" className="text-ink-secondary">
          {timeAgo(review.created_at)}
        </Text>
      </View>
      <StarRow rating={review.rating} size={16} />
      {review.comment ? <Text variant="body-md">{review.comment}</Text> : null}
      {review.tags.length > 0 ? (
        <View className="flex-row flex-wrap gap-space-xs">
          {review.tags.map((t) => (
            <View key={t} className="rounded-full bg-brand-soft px-2.5 py-1">
              <Text variant="label-sm" className="text-brand">
                {t}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {review.photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-space-sm">
            {review.photos.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                className="h-20 w-20 rounded-md"
                accessibilityIgnoresInvertColors
              />
            ))}
          </View>
        </ScrollView>
      ) : null}
    </Card>
  );
});
