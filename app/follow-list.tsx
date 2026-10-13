import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PersonRowItem } from '@/components/social/PersonRow';
import { Button, HeadlineMd, Skeleton, Text } from '@/components/ui';
import { useFollowList, useFollowOp } from '@/hooks/useSocialQueries';
import { tr } from '@/i18n/tr';
import { useSessionStore } from '@/stores/sessionStore';
import { colors } from '@/theme/tokens';

/** Takipçi / takip edilen listesi. Kendi listende takipçiyi çıkarma düğmesi de var. */
export default function FollowListScreen() {
  const insets = useSafeAreaInsets();
  const { id, kind } = useLocalSearchParams<{ id: string; kind: 'followers' | 'following' }>();
  const k = kind === 'following' ? 'following' : 'followers';
  const myId = useSessionStore((s) => s.session?.user.id);
  const list = useFollowList(id, k);
  const op = useFollowOp();
  const people = list.data?.pages.flat() ?? [];
  const mine = id === myId;

  return (
    <View className="flex-1 bg-canvas">
      <View
        className="flex-row items-center justify-between px-space-sm pb-space-sm"
        style={{ paddingTop: insets.top + 4 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.common.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={8}
          className="h-11 w-11 items-center justify-center"
        >
          <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.ink.DEFAULT} />
        </Pressable>
        <HeadlineMd>{k === 'followers' ? tr.people.followers : tr.people.following}</HeadlineMd>
        <View className="h-11 w-11" />
      </View>

      <FlatList
        data={people}
        keyExtractor={(p) => p.user_id}
        contentContainerClassName="px-margin pb-space-xl"
        renderItem={({ item }) => (
          <PersonRowItem
            person={item}
            trailing={
              mine && k === 'followers' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tr.follow.remove}
                  onPress={() => op.mutate({ op: 'remove', targetId: item.user_id })}
                  className="h-11 w-11 items-center justify-center rounded-full bg-surface-container"
                >
                  <MaterialIcons name="person-remove" size={20} color={colors.ink.secondary} />
                </Pressable>
              ) : undefined
            }
          />
        )}
        ListEmptyComponent={
          list.isPending ? (
            <View className="gap-space-md">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </View>
          ) : list.isError ? (
            <View className="items-center gap-space-md py-space-lg">
              <Text variant="body-md" className="text-ink-secondary">
                {tr.people.errorLoad}
              </Text>
              <Button
                title={tr.common.retry}
                variant="secondary"
                onPress={() => void list.refetch()}
              />
            </View>
          ) : (
            <Text variant="body-md" className="py-space-lg text-center text-ink-secondary">
              {k === 'followers' ? tr.people.emptyFollowers : tr.people.emptyFollowing}
            </Text>
          )
        }
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <ActivityIndicator className="py-space-md" color={colors.brand.DEFAULT} />
          ) : null
        }
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}
