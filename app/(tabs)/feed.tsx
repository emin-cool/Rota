import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityFeedCard } from '@/components/social/ActivityFeedCard';
import {
  Button,
  Card,
  Chip,
  HeadlineLg,
  HeadlineMd,
  ListSeparator,
  Skeleton,
  Text,
} from '@/components/ui';
import { useFeed, useNewPosts, useToggleKudos } from '@/hooks/useSocialQueries';
import { tr } from '@/i18n/tr';
import { FEED_FILTERS, type FeedFilter } from '@/lib/social';
import { colors } from '@/theme/tokens';
import type { FeedActivity } from '@/types/database';

function CardSkeleton() {
  return (
    <Card className="gap-space-md p-space-md">
      <View className="flex-row items-center gap-space-md">
        <Skeleton className="h-11 w-11 rounded-full" />
        <View className="gap-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </View>
      </View>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-14 w-full" />
    </Card>
  );
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FeedFilter>('all');
  const query = useFeed(filter);
  const { mutate: mutateKudos } = useToggleKudos();

  const items = useMemo(() => query.data?.pages.flat() ?? [], [query.data]);
  const newest = items[0]?.created_at ?? null;
  const fresh = useNewPosts(filter === 'all' ? newest : null);

  const openActivity = useCallback(
    (id: string) => router.push({ pathname: '/activity/[id]', params: { id } }),
    [],
  );
  const openProfile = useCallback(
    (id: string) => router.push({ pathname: '/user/[id]', params: { id } }),
    [],
  );
  const toggleKudos = useCallback(
    (a: FeedActivity) => mutateKudos({ activityId: a.id, on: !a.kudosed }),
    [mutateKudos],
  );
  const share = useCallback((a: FeedActivity) => {
    const title = a.title?.trim() || tr.social.untitled[a.activity_type];
    void Share.share({
      message: tr.social.shareMessage(
        a.display_name,
        title,
        (a.distance_m / 1000).toFixed(1).replace('.', ','),
      ),
    });
  }, []);

  const refresh = async () => {
    fresh.reset();
    await query.refetch();
  };

  const empty = (() => {
    if (query.isPending) {
      return (
        <View className="gap-space-md">
          <CardSkeleton />
          <CardSkeleton />
        </View>
      );
    }
    if (query.isError) {
      return (
        <View className="items-center gap-space-md py-space-xl">
          <MaterialIcons name="cloud-off" size={40} color={colors.ink.muted} />
          <HeadlineMd className="text-center">{tr.social.errorTitle}</HeadlineMd>
          <Text variant="body-md" className="text-center text-ink-secondary">
            {tr.social.errorBody}
          </Text>
          <Button
            title={tr.common.retry}
            variant="secondary"
            onPress={() => void query.refetch()}
          />
        </View>
      );
    }
    return (
      <View className="items-center gap-space-md rounded-lg bg-surface-container-low px-margin py-space-xl">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-white">
          <MaterialIcons name="groups" size={32} color={colors.brand.DEFAULT} />
        </View>
        <HeadlineMd className="text-center">
          {filter === 'all' ? tr.social.emptyTitle : tr.social.emptyFiltered}
        </HeadlineMd>
        {filter === 'all' ? (
          <>
            <Text variant="body-md" className="text-center text-ink-secondary">
              {tr.social.emptyBody}
            </Text>
            <Button title={tr.social.findPeople} onPress={() => router.push('/people')} />
          </>
        ) : null}
      </View>
    );
  })();

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="gap-space-md px-margin pb-space-sm pt-space-md">
        <View className="flex-row items-center justify-between">
          <HeadlineLg>{tr.social.feedTitle}</HeadlineLg>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr.social.searchPeople}
            onPress={() => router.push('/people')}
            className="h-11 w-11 items-center justify-center rounded-full bg-brand-soft"
          >
            <MaterialIcons name="person-search" size={22} color={colors.brand.DEFAULT} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-space-sm">
            {FEED_FILTERS.map((f) => (
              <Chip
                key={f}
                label={tr.social.filters[f]}
                selected={filter === f}
                onPress={() => setFilter(f)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        contentContainerClassName="px-margin pb-space-xl pt-space-sm"
        ItemSeparatorComponent={ListSeparator}
        ListHeaderComponent={
          items.length > 0 ? (
            <View className="pb-space-md">
              <HeadlineMd>{tr.social.sectionRecent}</HeadlineMd>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <ActivityFeedCard
            activity={item}
            onOpen={openActivity}
            onOpenProfile={openProfile}
            onToggleKudos={toggleKudos}
            onShare={share}
          />
        )}
        ListEmptyComponent={empty}
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator className="py-space-md" color={colors.brand.DEFAULT} />
          ) : null
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => void refresh()}
      />

      {fresh.count > 0 ? (
        <View
          pointerEvents="box-none"
          className="absolute inset-x-0 items-center"
          style={{ top: insets.top + 120 }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr.social.newPosts(fresh.count)}
            onPress={() => void refresh()}
            className="min-h-[44px] flex-row items-center gap-space-sm rounded-full bg-brand px-space-lg"
          >
            <MaterialIcons name="arrow-upward" size={18} color={colors.white} />
            <Text variant="body-md" className="font-bold text-on-primary">
              {tr.social.newPosts(fresh.count)}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
