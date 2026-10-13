import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityTrackMap } from '@/components/activity/ActivityTrackMap';
import { activityStats, ActivityHeader } from '@/components/social/ActivityFeedCard';
import { Avatar, Button, Card, HeadlineMd, Skeleton, Text } from '@/components/ui';
import {
  useActivity,
  useAddComment,
  useComments,
  useDeleteComment,
  useToggleKudos,
} from '@/hooks/useSocialQueries';
import { tr } from '@/i18n/tr';
import { timeAgo } from '@/lib/explore';
import type { LngLat } from '@/lib/geo';
import { activityTitle, formatCount, normalizeComment } from '@/lib/social';
import { MoreButton } from '@/components/social/ModerationSheet';
import { useModerationStore } from '@/stores/moderationStore';
import { colors } from '@/theme/tokens';

export default function ActivityDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const activity = useActivity(id);
  const comments = useComments(id);
  const addComment = useAddComment(id ?? '');
  const deleteComment = useDeleteComment(id ?? '');
  const { mutate: toggleKudos } = useToggleKudos();
  const [text, setText] = useState('');
  const [sendError, setSendError] = useState(false);

  const a = activity.data;
  const list = comments.data?.pages.flat() ?? [];
  const canSend = normalizeComment(text) !== null && !addComment.isPending;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const openProfile = useCallback(
    (userId: string) => router.push({ pathname: '/user/[id]', params: { id: userId } }),
    [],
  );

  const send = () => {
    setSendError(false);
    addComment.mutate(text, {
      onSuccess: () => setText(''),
      onError: () => setSendError(true),
    });
  };

  const confirmDelete = (commentId: string) =>
    Alert.alert(tr.social.commentDeleteConfirmTitle, undefined, [
      { text: tr.social.cancel, style: 'cancel' },
      {
        text: tr.social.deleteAction,
        style: 'destructive',
        onPress: () => deleteComment.mutate(commentId),
      },
    ]);

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
      <HeadlineMd>{tr.social.activityTitle}</HeadlineMd>
      <View className="h-11 w-11" />
    </View>
  );

  if (activity.isPending) {
    return (
      <View className="flex-1 bg-canvas">
        {header}
        <View className="gap-space-md px-margin">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-16 w-full" />
        </View>
      </View>
    );
  }

  if (activity.isError || !a) {
    return (
      <View className="flex-1 bg-canvas">
        {header}
        <View className="items-center gap-space-md px-margin py-space-xl">
          <MaterialIcons name="lock-outline" size={40} color={colors.ink.muted} />
          <Text variant="body-lg" className="text-center">
            {activity.isError ? tr.social.errorTitle : tr.social.activityNotFound}
          </Text>
          {activity.isError ? (
            <Button
              title={tr.common.retry}
              variant="secondary"
              onPress={() => void activity.refetch()}
            />
          ) : null}
        </View>
      </View>
    );
  }

  const title = activityTitle(a, tr.social.untitled);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-canvas"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {header}
      <ScrollView
        contentContainerClassName="gap-space-md px-margin pb-space-lg"
        keyboardShouldPersistTaps="handled"
      >
        <ActivityHeader a={a} onOpenProfile={openProfile} />
        <View className="gap-1">
          <Text variant="headline-md">{title}</Text>
          {a.description ? (
            <Text variant="body-md" className="text-ink-secondary">
              {a.description}
            </Text>
          ) : null}
        </View>

        {a.track && a.track.coordinates.length > 1 ? (
          <View className="h-[240px] overflow-hidden rounded-lg border border-hairline">
            <ActivityTrackMap track={a.track.coordinates as LngLat[]} />
          </View>
        ) : null}

        {a.photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-space-sm">
              {a.photos.map((uri) => (
                <Image
                  key={uri}
                  source={{ uri }}
                  className="h-40 w-56 rounded-md"
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ))}
            </View>
          </ScrollView>
        ) : null}

        <View className="flex-row rounded-lg bg-surface-container-low py-space-md">
          {activityStats(a).map((s) => (
            <View key={s.label} className="flex-1 items-center gap-0.5">
              <Text variant="label-caps" className="text-ink-secondary">
                {s.label}
              </Text>
              <Text variant="headline-sm" className="text-brand" numberOfLines={1}>
                {s.value}
              </Text>
            </View>
          ))}
        </View>

        <View className="flex-row items-center gap-space-sm">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${a.kudosed ? tr.social.kudosed : tr.social.kudos}, ${a.kudos_count}`}
            accessibilityState={{ selected: a.kudosed }}
            onPress={() => toggleKudos({ activityId: a.id, on: !a.kudosed })}
            className={`min-h-[44px] flex-row items-center gap-space-sm rounded-full px-space-md ${
              a.kudosed ? 'bg-accent-soft' : 'bg-surface-container'
            }`}
          >
            <Text variant="body-md">👏</Text>
            <Text
              variant="body-md-medium"
              className={a.kudosed ? 'font-bold text-accent-deep' : 'text-ink-secondary'}
            >
              {formatCount(a.kudos_count)} {tr.social.kudos}
            </Text>
          </Pressable>
          <View className="flex-1" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr.social.share}
            onPress={() =>
              void Share.share({
                message: tr.social.shareMessage(
                  a.display_name,
                  title,
                  (a.distance_m / 1000).toFixed(1).replace('.', ','),
                ),
              })
            }
            className="h-11 w-11 items-center justify-center rounded-full bg-brand-soft"
          >
            <MaterialIcons name="share" size={20} color={colors.brand.DEFAULT} />
          </Pressable>
        </View>

        <HeadlineMd>
          {tr.social.commentsTitle} ({a.comment_count})
        </HeadlineMd>
        {comments.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : comments.isError ? (
          <Text variant="body-md" className="text-ink-secondary">
            {tr.social.errorBody}
          </Text>
        ) : list.length === 0 ? (
          <Text variant="body-md" className="text-ink-secondary">
            {tr.social.noComments}
          </Text>
        ) : (
          list.map((c) => (
            <Card key={c.id} className="flex-row items-start gap-space-md p-space-md">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={c.display_name}
                onPress={() => openProfile(c.user_id)}
              >
                <Avatar name={c.display_name} uri={c.avatar_url} size={36} />
              </Pressable>
              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center gap-space-sm">
                  <Text variant="body-md" className="font-bold" numberOfLines={1}>
                    {c.mine ? tr.social.you : c.display_name}
                  </Text>
                  <Text variant="label-sm" className="text-ink-secondary">
                    {timeAgo(c.created_at)}
                  </Text>
                </View>
                <Text variant="body-md">{c.body}</Text>
              </View>
              {c.mine ? null : (
                <MoreButton
                  label={tr.moderation.more}
                  onPress={() =>
                    useModerationStore.getState().open({
                      type: 'comment',
                      targetId: c.id,
                      ownerId: c.user_id,
                      ownerName: c.display_name,
                    })
                  }
                />
              )}
              {c.can_delete ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tr.social.commentDelete}
                  onPress={() => confirmDelete(c.id)}
                  hitSlop={8}
                  className="h-11 w-11 items-center justify-center"
                >
                  <MaterialIcons name="delete-outline" size={20} color={colors.ink.secondary} />
                </Pressable>
              ) : null}
            </Card>
          ))
        )}
        {comments.hasNextPage ? (
          <Button
            title={tr.social.moreComments}
            variant="ghost"
            loading={comments.isFetchingNextPage}
            onPress={() => void comments.fetchNextPage()}
          />
        ) : null}
      </ScrollView>

      <View
        className="border-t border-hairline bg-canvas px-margin pt-space-sm"
        style={{ paddingBottom: insets.bottom + 8 }}
      >
        {sendError ? (
          <Text variant="label-sm" className="pb-1 text-error">
            {tr.social.commentSendError}
          </Text>
        ) : null}
        <View className="flex-row items-center gap-space-sm">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={tr.social.commentPlaceholder}
            placeholderTextColor={colors.ink.muted}
            accessibilityLabel={tr.social.commentPlaceholder}
            maxLength={500}
            multiline
            className="max-h-24 min-h-[44px] flex-1 rounded-lg border border-hairline bg-surface-container-lowest px-space-md py-2 font-regular text-body-md text-ink"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr.social.commentSend}
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={send}
            className={`h-11 w-11 items-center justify-center rounded-full ${canSend ? 'bg-brand' : 'bg-surface-container-high'}`}
          >
            {addComment.isPending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <MaterialIcons
                name="send"
                size={20}
                color={canSend ? colors.white : colors.ink.muted}
              />
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
