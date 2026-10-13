import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PersonRowItem } from '@/components/social/PersonRow';
import { Button, HeadlineMd, Skeleton, Text } from '@/components/ui';
import { useFollowOp, useFollowRequests } from '@/hooks/useSocialQueries';
import { tr } from '@/i18n/tr';
import { colors } from '@/theme/tokens';

/** Gizli hesabına gelen takip istekleri: kabul et / reddet. */
export default function FollowRequestsScreen() {
  const insets = useSafeAreaInsets();
  const list = useFollowRequests();
  const op = useFollowOp();
  const requests = list.data?.pages.flat() ?? [];

  const act = (o: 'accept' | 'decline', targetId: string) =>
    op.mutate({ op: o, targetId }, { onError: () => Alert.alert(tr.follow.failed) });

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
        <HeadlineMd>{tr.people.requests}</HeadlineMd>
        <View className="h-11 w-11" />
      </View>

      <FlatList
        data={requests}
        keyExtractor={(r) => r.user_id}
        contentContainerClassName="px-margin pb-space-xl"
        ItemSeparatorComponent={() => <View className="h-space-sm" />}
        renderItem={({ item }) => (
          <View className="gap-space-sm">
            <PersonRowItem person={{ ...item, follow_state: 'requested_me' }} trailing={<View />} />
            <View className="flex-row gap-space-sm">
              <Button
                title={tr.follow.accept}
                className="flex-1"
                loading={op.isPending}
                onPress={() => act('accept', item.user_id)}
              />
              <Button
                title={tr.follow.decline}
                variant="secondary"
                className="flex-1"
                disabled={op.isPending}
                onPress={() => act('decline', item.user_id)}
              />
            </View>
          </View>
        )}
        ListEmptyComponent={
          list.isPending ? (
            <Skeleton className="h-16 w-full" />
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
              {tr.people.requestsEmpty}
            </Text>
          )
        }
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}
