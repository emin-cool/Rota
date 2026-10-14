import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityFeedCard } from '@/components/social/ActivityFeedCard';
import { FollowButton } from '@/components/social/FollowButton';
import {
  Avatar,
  Button,
  Card,
  HeadlineLg,
  HeadlineMd,
  ListSeparator,
  Skeleton,
  Text,
} from '@/components/ui';
import {
  useBlockOp,
  useFollowOp,
  useProfileCard,
  useToggleKudos,
  useUserActivities,
} from '@/hooks/useSocialQueries';
import { tr } from '@/i18n/tr';
import { formatCount } from '@/lib/social';
import { formatTotalKm } from '@/lib/profileStats';
import { useSessionStore } from '@/stores/sessionStore';
import { MoreButton } from '@/components/social/ModerationSheet';
import { useModerationStore } from '@/stores/moderationStore';
import { colors } from '@/theme/tokens';
import type { FeedActivity } from '@/types/database';

function Count({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${value} ${label}`}
      disabled={!onPress}
      onPress={onPress}
      className="min-h-[56px] flex-1 items-center justify-center"
    >
      <Text variant="headline-md">{formatCount(value)}</Text>
      <Text variant="label-sm" className="text-ink-secondary">
        {label}
      </Text>
    </Pressable>
  );
}

export default function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const myId = useSessionStore((s) => s.session?.user.id);
  const card = useProfileCard(id);
  const canView = card.data?.can_view ?? false;
  const activities = useUserActivities(id, canView);
  const { mutate: mutateKudos } = useToggleKudos();
  const followOp = useFollowOp();
  const blockOp = useBlockOp();

  // Kendi profiline gelinirse profil sekmesine yönlendir.
  useEffect(() => {
    if (id && myId && id === myId) router.replace('/profile');
  }, [id, myId]);

  const items = useMemo(() => activities.data?.pages.flat() ?? [], [activities.data]);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const openActivity = useCallback(
    (aid: string) => router.push({ pathname: '/activity/[id]', params: { id: aid } }),
    [],
  );
  const noop = useCallback(() => undefined, []);
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

  const header = (
    <View
      className="flex-row items-center justify-between px-space-sm pb-space-sm"
      style={{ paddingTop: insets.top + 4 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr.common.back}
        onPress={goBack}
        hitSlop={8}
        className="h-11 w-11 items-center justify-center"
      >
        <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.ink.DEFAULT} />
      </Pressable>
      <HeadlineMd>{tr.userProfile.title}</HeadlineMd>
      {card.data && card.data.user_id !== myId ? (
        <MoreButton
          label={tr.moderation.more}
          onPress={() =>
            useModerationStore.getState().open({
              type: 'profile',
              targetId: card.data!.user_id,
              ownerId: card.data!.user_id,
              ownerName: card.data!.display_name,
            })
          }
        />
      ) : (
        <View className="h-11 w-11" />
      )}
    </View>
  );

  if (card.isPending) {
    return (
      <View className="flex-1 bg-canvas">
        {header}
        <View className="gap-space-md px-margin">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </View>
      </View>
    );
  }

  const p = card.data;
  if (card.isError || !p) {
    return (
      <View className="flex-1 bg-canvas">
        {header}
        <View className="items-center gap-space-md px-margin py-space-xl">
          <Text variant="body-lg" className="text-center">
            {card.isError ? tr.social.errorTitle : tr.userProfile.notFound}
          </Text>
          {card.isError ? (
            <Button
              title={tr.common.retry}
              variant="secondary"
              onPress={() => void card.refetch()}
            />
          ) : null}
        </View>
      </View>
    );
  }

  const listHeader = (
    <View className="gap-space-md pb-space-md">
      <Card elevation="raised" className="gap-space-md p-space-md">
        <View className="flex-row items-center gap-space-md">
          <Avatar name={p.display_name} uri={p.avatar_url} size={72} />
          <View className="flex-1 gap-1">
            <HeadlineLg numberOfLines={1}>{p.display_name}</HeadlineLg>
            <View className="flex-row flex-wrap items-center gap-space-sm">
              {p.level ? (
                <View className="rounded-full bg-primary-fixed px-3 py-1">
                  <Text variant="label-sm" className="font-bold text-brand">
                    {tr.profile.level[p.level]}
                  </Text>
                </View>
              ) : null}
              <Text variant="body-md" className="text-ink-secondary">
                @{p.username}
              </Text>
              {p.is_private ? (
                <MaterialIcons name="lock" size={16} color={colors.ink.secondary} />
              ) : null}
            </View>
          </View>
        </View>
        <View className="flex-row rounded-lg bg-surface-container-low">
          <Count
            value={p.followers_count}
            label={tr.userProfile.followers}
            onPress={() =>
              router.push({
                pathname: '/follow-list',
                params: { id: p.user_id, kind: 'followers' },
              })
            }
          />
          <Count
            value={p.following_count}
            label={tr.userProfile.following}
            onPress={() =>
              router.push({
                pathname: '/follow-list',
                params: { id: p.user_id, kind: 'following' },
              })
            }
          />
          <Count value={p.route_count} label={tr.userProfile.routes} />
        </View>
        {p.blocked_by_me ? (
          <View className="gap-space-sm rounded-lg bg-surface-container-low p-space-md">
            <Text variant="body-md" className="font-bold">
              {tr.moderation.blockedByMeTitle}
            </Text>
            <Text variant="label-sm" className="text-ink-secondary">
              {tr.moderation.blockedByMeBody}
            </Text>
            <Button
              title={tr.moderation.unblock}
              variant="secondary"
              loading={blockOp.isPending}
              onPress={() =>
                blockOp.mutate(
                  { op: 'unblock', targetId: p.user_id },
                  { onError: () => Alert.alert(tr.moderation.unblockError) },
                )
              }
            />
          </View>
        ) : (
          <FollowButton targetId={p.user_id} targetName={p.display_name} state={p.follow_state} />
        )}
        {!p.blocked_by_me && p.follow_state === 'requested_me' ? (
          <Button
            title={tr.follow.decline}
            variant="secondary"
            loading={followOp.isPending}
            onPress={() => followOp.mutate({ op: 'decline', targetId: p.user_id })}
          />
        ) : null}
      </Card>

      {canView ? (
        <View className="flex-row gap-space-sm">
          <Card className="flex-1 items-center p-space-md">
            <Text variant="headline-md">{p.activity_count}</Text>
            <Text variant="label-sm" className="text-ink-secondary">
              {tr.userProfile.activities}
            </Text>
          </Card>
          <Card className="flex-1 items-center p-space-md">
            <Text variant="headline-md">{formatTotalKm(p.total_distance_m)} km</Text>
            <Text variant="label-sm" className="text-ink-secondary">
              {tr.userProfile.totalDistance}
            </Text>
          </Card>
        </View>
      ) : null}
    </View>
  );

  const empty = !canView ? (
    <View className="items-center gap-space-sm rounded-lg bg-surface-container-low px-margin py-space-xl">
      <MaterialIcons name="lock-outline" size={32} color={colors.brand.DEFAULT} />
      <HeadlineMd className="text-center">{tr.userProfile.privateTitle}</HeadlineMd>
      <Text variant="body-md" className="text-center text-ink-secondary">
        {tr.userProfile.privateBody}
      </Text>
    </View>
  ) : activities.isPending ? (
    <Skeleton className="h-48 w-full" />
  ) : (
    <Text variant="body-md" className="text-center text-ink-secondary">
      {tr.userProfile.noActivities}
    </Text>
  );

  return (
    <View className="flex-1 bg-canvas">
      {header}
      <FlatList
        data={canView ? items : []}
        keyExtractor={(a) => a.id}
        contentContainerClassName="px-margin pb-space-xl"
        ListHeaderComponent={listHeader}
        ItemSeparatorComponent={ListSeparator}
        renderItem={({ item }) => (
          <ActivityFeedCard
            activity={item}
            onOpen={openActivity}
            onOpenProfile={noop}
            onToggleKudos={toggleKudos}
            onShare={share}
          />
        )}
        ListEmptyComponent={empty}
        ListFooterComponent={
          activities.isFetchingNextPage ? (
            <ActivityIndicator className="py-space-md" color={colors.brand.DEFAULT} />
          ) : null
        }
        onEndReached={() => {
          if (activities.hasNextPage && !activities.isFetchingNextPage)
            void activities.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}
