import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PersonRowItem } from '@/components/social/PersonRow';
import { Button, HeadlineMd, Skeleton, Text } from '@/components/ui';
import { useBlockedUsers, useBlockOp } from '@/hooks/useSocialQueries';
import { tr } from '@/i18n/tr';
import { colors } from '@/theme/tokens';

/** Engellediğin kullanıcılar: listele ve engeli kaldır. */
export default function BlockedUsersScreen() {
  const insets = useSafeAreaInsets();
  const list = useBlockedUsers();
  const op = useBlockOp();
  const users = list.data ?? [];

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
        <HeadlineMd>{tr.blockedUsers.title}</HeadlineMd>
        <View className="h-11 w-11" />
      </View>

      <FlatList
        data={users}
        keyExtractor={(u) => u.user_id}
        contentContainerClassName="px-margin pb-space-xl"
        renderItem={({ item }) => (
          <PersonRowItem
            person={{ ...item, follow_state: 'none' }}
            trailing={
              <Button
                title={tr.moderation.unblock}
                variant="secondary"
                disabled={op.isPending}
                onPress={() =>
                  op.mutate(
                    { op: 'unblock', targetId: item.user_id },
                    { onError: () => Alert.alert(tr.moderation.unblockError) },
                  )
                }
                className="h-11 px-space-md"
              />
            }
          />
        )}
        ListEmptyComponent={
          list.isPending ? (
            <Skeleton className="h-14 w-full" />
          ) : list.isError ? (
            <View className="items-center gap-space-md py-space-lg">
              <Text variant="body-md" className="text-ink-secondary">
                {tr.blockedUsers.errorLoad}
              </Text>
              <Button
                title={tr.common.retry}
                variant="secondary"
                onPress={() => void list.refetch()}
              />
            </View>
          ) : (
            <Text variant="body-md" className="py-space-lg text-center text-ink-secondary">
              {tr.blockedUsers.empty}
            </Text>
          )
        }
      />
    </View>
  );
}
