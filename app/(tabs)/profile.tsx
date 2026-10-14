import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityCard } from '@/components/profile/ActivityCard';
import { WeeklyChart } from '@/components/profile/WeeklyChart';
import { ExploreCard } from '@/components/route/ExploreCard';
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
import { useMyActivities, useMyStats, useScopedRoutes, useWeekly } from '@/hooks/useProfileQueries';
import { useToggleSaved } from '@/hooks/useRouteQueries';
import { useSocialCounts } from '@/hooks/useSocialQueries';
import { formatCount } from '@/lib/social';
import { tr } from '@/i18n/tr';
import { formatChange, formatTotalHours, formatTotalKm, summarizeWeek } from '@/lib/profileStats';
import { formatDistance } from '@/lib/geo';
import { useSessionStore } from '@/stores/sessionStore';
import { colors } from '@/theme/tokens';
import type { ActivityListItem, ExploreRoute } from '@/types/database';

type Tab = 'activities' | 'routes' | 'saved';
type Row =
  | { kind: 'activity'; key: string; item: ActivityListItem }
  | { kind: 'route'; key: string; item: ExploreRoute };

function StatTile({
  icon,
  tint,
  value,
  unit,
  label,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  tint: string;
  value: string;
  unit?: string;
  label: string;
}) {
  return (
    <View className="min-h-[104px] flex-1 items-center justify-center gap-1 rounded-lg border border-hairline bg-surface-container-lowest p-space-sm">
      <MaterialIcons name={icon} size={22} color={tint} />
      <Text variant="headline-md" numberOfLines={1}>
        {value}
        {unit ? (
          <Text variant="label-sm" className="text-ink-secondary">
            {' '}
            {unit}
          </Text>
        ) : null}
      </Text>
      <Text variant="label-sm" className="text-center text-ink-secondary">
        {label}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const profile = useSessionStore((s) => s.profile);
  const [tab, setTab] = useState<Tab>('activities');

  const stats = useMyStats();
  const social = useSocialCounts();
  const openActivity = useCallback(
    (id: string) => router.push({ pathname: '/activity/[id]', params: { id } }),
    [],
  );
  const weekly = useWeekly();
  const activities = useMyActivities(tab === 'activities');
  const myRoutes = useScopedRoutes('mine', tab === 'routes');
  const savedRoutes = useScopedRoutes('saved', tab === 'saved');
  const toggle = useToggleSaved();

  const week = useMemo(() => (weekly.data ? summarizeWeek(weekly.data) : null), [weekly.data]);

  const current = tab === 'activities' ? activities : tab === 'routes' ? myRoutes : savedRoutes;
  const routePages = tab === 'routes' ? myRoutes.data : savedRoutes.data;
  const activityPages = activities.data;
  const rows = useMemo<Row[]>(() => {
    if (tab === 'activities') {
      return (activityPages?.pages.flat() ?? []).map((item) => ({
        kind: 'activity' as const,
        key: item.id,
        item,
      }));
    }
    return (routePages?.pages.flatMap((p) => p.items) ?? []).map((item) => ({
      kind: 'route' as const,
      key: item.id,
      item,
    }));
  }, [tab, activityPages, routePages]);

  const { mutate: mutateSaved } = toggle;
  const openRoute = useCallback(
    (id: string) => router.push({ pathname: '/route/[id]', params: { id } }),
    [],
  );
  const toggleSave = useCallback(
    (r: ExploreRoute) => mutateSaved({ routeId: r.id, saved: !r.saved }),
    [mutateSaved],
  );

  const header = (
    <View className="gap-space-md pb-space-md">
      {/* Kimlik kartı */}
      <Card elevation="raised" className="gap-space-md p-space-md">
        <View className="flex-row items-start justify-between">
          <Avatar
            name={profile?.display_name ?? profile?.username ?? null}
            uri={profile?.avatar_url}
            size={72}
          />
          <View className="flex-row items-center gap-space-sm">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr.profile.edit}
              onPress={() => router.push('/profile-edit')}
              className="min-h-[44px] flex-row items-center gap-space-sm rounded-full bg-brand-soft px-space-md"
            >
              <MaterialIcons name="edit" size={18} color={colors.brand.DEFAULT} />
              <Text variant="body-md-medium" className="font-bold text-brand">
                {tr.profile.edit}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr.profile.settings}
              onPress={() => router.push('/settings')}
              className="h-11 w-11 items-center justify-center rounded-full bg-surface-container"
            >
              <MaterialIcons name="settings" size={22} color={colors.ink.DEFAULT} />
            </Pressable>
          </View>
        </View>
        <View className="gap-1">
          <HeadlineLg numberOfLines={1}>
            {profile?.display_name ?? profile?.username ?? ''}
          </HeadlineLg>
          <View className="flex-row flex-wrap items-center gap-space-sm">
            {profile?.level ? (
              <View className="rounded-full bg-primary-fixed px-3 py-1">
                <Text variant="label-sm" className="font-bold text-brand">
                  {tr.profile.level[profile.level]}
                </Text>
              </View>
            ) : null}
            <Text variant="body-md" className="text-ink-secondary">
              @{profile?.username}
            </Text>
          </View>
        </View>
      </Card>

      {/* Takipçi / takip / rota */}
      <View className="flex-row rounded-lg border border-hairline bg-surface-container-lowest">
        {(
          [
            ['followers', social.data?.followers_count, tr.userProfile.followers],
            ['following', social.data?.following_count, tr.userProfile.following],
            ['routes', social.data?.route_count, tr.userProfile.routes],
          ] as const
        ).map(([key, value, label]) => (
          <Pressable
            key={key}
            accessibilityRole={key === 'routes' ? undefined : 'button'}
            accessibilityLabel={`${value ?? 0} ${label}`}
            disabled={key === 'routes'}
            onPress={() =>
              router.push({
                pathname: '/follow-list',
                params: {
                  id: profile?.user_id ?? '',
                  kind: key === 'followers' ? 'followers' : 'following',
                },
              })
            }
            className="min-h-[60px] flex-1 items-center justify-center"
          >
            <Text variant="headline-md">{formatCount(value ?? 0)}</Text>
            <Text variant="label-sm" className="text-ink-secondary">
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr.courses.myCourses}
        onPress={() => router.push('/courses')}
      >
        <Card className="min-h-[56px] flex-row items-center gap-space-md px-space-md">
          <MaterialIcons name="fitness-center" size={22} color={colors.brand.DEFAULT} />
          <View className="flex-1">
            <Text variant="body-lg" className="font-bold">
              {tr.courses.myCourses}
            </Text>
            <Text variant="label-sm" className="text-ink-secondary">
              {tr.courses.myCoursesHint}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.ink.muted} />
        </Card>
      </Pressable>
      {(social.data?.pending_requests ?? 0) > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.people.requests}
          onPress={() => router.push('/follow-requests')}
        >
          <Card className="min-h-[56px] flex-row items-center gap-space-md bg-accent-soft px-space-md">
            <MaterialIcons name="person-add" size={22} color={colors.accent.deep} />
            <Text variant="body-lg" className="flex-1 font-bold">
              {tr.people.requests}
            </Text>
            <View className="min-w-[24px] items-center rounded-full bg-accent-deep px-2 py-0.5">
              <Text variant="label-sm" className="font-bold text-white">
                {social.data?.pending_requests}
              </Text>
            </View>
          </Card>
        </Pressable>
      ) : null}

      {/* İstatistikler */}
      {stats.isPending ? (
        <View className="flex-row gap-space-sm">
          <Skeleton className="h-[104px] flex-1" />
          <Skeleton className="h-[104px] flex-1" />
          <Skeleton className="h-[104px] flex-1" />
        </View>
      ) : stats.isError ? (
        <Text variant="body-md" className="text-ink-secondary">
          {tr.profile.statsError}
        </Text>
      ) : (
        <View className="flex-row gap-space-sm">
          <StatTile
            icon="place"
            tint={colors.brand.DEFAULT}
            value={formatTotalKm(stats.data.total_distance_m)}
            unit={tr.profile.unitKm}
            label={tr.profile.totalDistance}
          />
          <StatTile
            icon="directions-run"
            tint={colors.accent.DEFAULT}
            value={String(stats.data.activity_count)}
            label={tr.profile.activities}
          />
          <StatTile
            icon="timer"
            tint={colors.activity.bike}
            value={formatTotalHours(stats.data.total_duration_sec)}
            unit={tr.profile.unitHour}
            label={tr.profile.totalTime}
          />
        </View>
      )}

      {/* Haftalık performans */}
      <Card elevation="raised" className="gap-space-md p-space-md">
        <Text variant="label-caps" className="text-ink-secondary">
          {tr.profile.weeklyTitle}
        </Text>
        {weekly.isPending ? (
          <Skeleton className="h-[170px] w-full" />
        ) : weekly.isError || !week ? (
          <Text variant="body-md" className="text-ink-secondary">
            {tr.profile.statsError}
          </Text>
        ) : (
          <>
            <View className="flex-row items-end justify-between">
              <HeadlineMd className="flex-1">{tr.profile.weeklyHeading}</HeadlineMd>
              <View className="items-end">
                <Text variant="headline-md" className="text-brand">
                  {formatDistance(week.thisTotalM)}
                </Text>
                {week.changePct !== null ? (
                  <Text variant="label-sm" className="font-bold text-brand">
                    {formatChange(week.changePct)} {tr.profile.weeklyVsLast}
                  </Text>
                ) : null}
              </View>
            </View>
            {week.thisTotalM === 0 ? (
              <Text variant="body-md" className="text-ink-secondary">
                {tr.profile.weeklyEmpty}
              </Text>
            ) : null}
            <WeeklyChart valuesM={week.thisWeekM} peakIndex={week.peakIndex} />
          </>
        )}
      </Card>

      {/* Sekmeler */}
      <View className="flex-row rounded-lg bg-surface-container p-1">
        {(['activities', 'routes', 'saved'] as const).map((t) => (
          <Pressable
            key={t}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            onPress={() => setTab(t)}
            className={`min-h-[44px] flex-1 items-center justify-center rounded-md px-1 ${
              tab === t ? 'bg-white' : ''
            }`}
          >
            <Text
              variant="body-md-medium"
              className={
                tab === t ? 'text-center font-bold text-brand' : 'text-center text-ink-secondary'
              }
              numberOfLines={1}
            >
              {tr.profile.tabs[t]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const empty = (() => {
    if (current.isPending) {
      return (
        <View className="gap-space-md">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </View>
      );
    }
    if (current.isError) {
      return (
        <View className="items-center gap-space-md py-space-lg">
          <Text variant="body-md" className="text-center text-ink-secondary">
            {tr.profile.listError}
          </Text>
          <Button
            title={tr.common.retry}
            variant="secondary"
            onPress={() => void current.refetch()}
          />
        </View>
      );
    }
    const copy = {
      activities: [tr.profile.emptyActivitiesTitle, tr.profile.emptyActivitiesBody],
      routes: [tr.profile.emptyRoutesTitle, tr.profile.emptyRoutesBody],
      saved: [tr.profile.emptySavedTitle, tr.profile.emptySavedBody],
    }[tab];
    return (
      <View className="items-center gap-space-sm rounded-lg bg-surface-container-low px-margin py-space-xl">
        <MaterialIcons
          name={
            tab === 'activities'
              ? 'directions-run'
              : tab === 'routes'
                ? 'alt-route'
                : 'favorite-border'
          }
          size={32}
          color={colors.brand.DEFAULT}
        />
        <HeadlineMd className="text-center">{copy[0]}</HeadlineMd>
        <Text variant="body-md" className="text-center text-ink-secondary">
          {copy[1]}
        </Text>
      </View>
    );
  })();

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerClassName="px-margin pb-space-xl pt-space-md"
        ListHeaderComponent={header}
        ItemSeparatorComponent={ListSeparator}
        renderItem={({ item }) =>
          item.kind === 'activity' ? (
            <ActivityCard item={item.item} onPress={openActivity} />
          ) : (
            <ExploreCard route={item.item} onPress={openRoute} onToggleSave={toggleSave} />
          )
        }
        ListEmptyComponent={empty}
        ListFooterComponent={
          current.isFetchingNextPage ? (
            <ActivityIndicator className="py-space-md" color={colors.brand.DEFAULT} />
          ) : null
        }
        onEndReached={() => {
          if (current.hasNextPage && !current.isFetchingNextPage) void current.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}
