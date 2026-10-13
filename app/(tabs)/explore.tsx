import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExploreCard, FeaturedCard } from '@/components/route/ExploreCard';
import { ExploreFilterSheet } from '@/components/route/ExploreFilterSheet';
import { ExploreMap } from '@/components/route/ExploreMap';
import {
  type BottomSheetRef,
  Button,
  Card,
  Chip,
  HeadlineLg,
  HeadlineMd,
  ListSeparator,
  Skeleton,
  Text,
} from '@/components/ui';
import {
  useDistricts,
  useExploreRoutes,
  useFeaturedRoutes,
  useToggleSaved,
} from '@/hooks/useRouteQueries';
import { tr } from '@/i18n/tr';
import {
  countActiveFilters,
  EMPTY_FILTERS,
  type ExploreFilters,
  hasAnyFilter,
} from '@/lib/explore';
import { colors } from '@/theme/tokens';
import type { ExploreRoute } from '@/types/database';

const SEARCH_DEBOUNCE_MS = 350;

function CardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-44 w-full rounded-none" />
      <View className="flex-row gap-space-md p-space-md">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
      </View>
    </Card>
  );
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const sheet = useRef<BottomSheetRef>(null);

  const [filters, setFilters] = useState<ExploreFilters>(EMPTY_FILTERS);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Arama kutusu: yazmayı bırakınca sorgula.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, query: text })), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  const filtered = hasAnyFilter(filters);
  const activeCount = countActiveFilters(filters);

  const query = useExploreRoutes(filters);
  const featured = useFeaturedRoutes(!filtered);
  const districts = useDistricts();
  const toggle = useToggleSaved();

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const editors = featured.data?.items ?? [];

  const { mutate: mutateSaved } = toggle;
  const openRoute = useCallback(
    (id: string) => router.push({ pathname: '/route/[id]', params: { id } }),
    [],
  );
  const toggleSave = useCallback(
    (r: ExploreRoute) => mutateSaved({ routeId: r.id, saved: !r.saved }),
    [mutateSaved],
  );
  const clearAll = () => {
    setText('');
    setFilters(EMPTY_FILTERS);
  };
  const openSheet = () => sheet.current?.snapToIndex(0);
  const selected = items.find((r) => r.id === selectedId) ?? items[0] ?? null;

  const chipLabel = {
    activity: filters.activity ? tr.map.activity[filters.activity] : tr.explore.activity,
    duration: filters.duration ? tr.explore.durationBuckets[filters.duration] : tr.explore.duration,
    difficulty: filters.difficulty
      ? tr.detail.difficulty[filters.difficulty]
      : tr.explore.difficulty,
    district: filters.district ?? tr.explore.district,
  };

  const emptyView = (() => {
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
          <HeadlineMd className="text-center">{tr.explore.errorTitle}</HeadlineMd>
          <Text variant="body-md" className="text-center text-ink-secondary">
            {tr.explore.errorBody}
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
          <MaterialIcons name="explore" size={32} color={colors.brand.DEFAULT} />
        </View>
        <HeadlineMd className="text-center">
          {filtered ? tr.explore.emptyTitle : tr.explore.emptyNoRoutesTitle}
        </HeadlineMd>
        <Text variant="body-md" className="text-center text-ink-secondary">
          {filtered ? tr.explore.emptyBody : tr.explore.emptyNoRoutesBody}
        </Text>
        {filtered ? <Button title={tr.explore.clearFilters} onPress={clearAll} /> : null}
      </View>
    );
  })();

  const footer = (
    <View className="gap-space-lg pt-space-md">
      {query.isFetchingNextPage ? <ActivityIndicator color={colors.brand.DEFAULT} /> : null}
      {!filtered && editors.length > 0 ? (
        <View className="gap-space-md">
          <View className="flex-row items-center justify-between">
            <HeadlineMd>{tr.explore.editors}</HeadlineMd>
            <Text variant="label-caps" className="text-ink-secondary">
              {tr.explore.editorsCount(editors.length)}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-space-md">
              {editors.map((r) => (
                <FeaturedCard key={r.id} route={r} onPress={openRoute} onToggleSave={toggleSave} />
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      {/* Üst alan: başlık, arama, çipler, Liste/Harita */}
      <View className="gap-space-md px-margin pb-space-sm pt-space-md">
        <HeadlineLg>{tr.explore.title}</HeadlineLg>
        <View className="h-12 flex-row items-center rounded-full border border-hairline bg-surface-container-lowest pl-space-md pr-1">
          <MaterialIcons name="search" size={22} color={colors.brand.DEFAULT} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={tr.explore.searchPlaceholder}
            placeholderTextColor={colors.ink.muted}
            accessibilityLabel={tr.explore.searchPlaceholder}
            returnKeyType="search"
            className="ml-space-sm h-12 flex-1 font-regular text-body-md text-ink"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr.explore.filters}
            onPress={openSheet}
            className="h-11 w-11 items-center justify-center rounded-full bg-brand-soft"
          >
            <MaterialIcons name="tune" size={22} color={colors.brand.DEFAULT} />
            {activeCount > 0 ? (
              <View className="absolute right-0 top-0 h-5 min-w-[20px] items-center justify-center rounded-full bg-accent-deep px-1">
                <Text variant="label-sm" className="font-bold text-white">
                  {activeCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-space-sm">
            <Chip
              label={tr.explore.topRated}
              selected={filters.topRated}
              onPress={() => setFilters((f) => ({ ...f, topRated: !f.topRated }))}
            />
            <Chip label={chipLabel.activity} selected={!!filters.activity} onPress={openSheet} />
            <Chip label={chipLabel.duration} selected={!!filters.duration} onPress={openSheet} />
            <Chip
              label={chipLabel.difficulty}
              selected={!!filters.difficulty}
              onPress={openSheet}
            />
            <Chip label={chipLabel.district} selected={!!filters.district} onPress={openSheet} />
          </View>
        </ScrollView>

        <View className="flex-row self-center rounded-full bg-surface-container p-1">
          {(['list', 'map'] as const).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === m }}
              onPress={() => setMode(m)}
              className={`min-h-[40px] min-w-[120px] flex-row items-center justify-center gap-space-sm rounded-full px-space-md ${
                mode === m ? 'bg-white' : ''
              }`}
            >
              <MaterialIcons
                name={m === 'list' ? 'view-list' : 'map'}
                size={18}
                color={mode === m ? colors.brand.DEFAULT : colors.ink.secondary}
              />
              <Text
                variant="body-md-medium"
                className={mode === m ? 'font-bold text-brand' : 'text-ink-secondary'}
              >
                {m === 'list' ? tr.explore.list : tr.explore.map}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {mode === 'list' ? (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerClassName="px-margin pb-space-xl"
          ItemSeparatorComponent={ListSeparator}
          ListHeaderComponent={
            items.length > 0 ? (
              <View className="flex-row items-center justify-between pb-space-md pt-space-sm">
                <HeadlineMd>{filtered ? tr.explore.results : tr.explore.popular}</HeadlineMd>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <ExploreCard route={item} onPress={openRoute} onToggleSave={toggleSave} />
          )}
          ListEmptyComponent={emptyView}
          ListFooterComponent={footer}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <View className="flex-1">
          {items.length === 0 ? (
            <View className="flex-1 px-margin">{emptyView}</View>
          ) : (
            <>
              <ExploreMap
                routes={items}
                selectedId={selected?.id ?? null}
                onSelect={setSelectedId}
              />
              {selected ? (
                <View className="absolute inset-x-0 bottom-0 px-margin pb-space-md">
                  <ExploreCard route={selected} onPress={openRoute} onToggleSave={toggleSave} />
                </View>
              ) : null}
            </>
          )}
        </View>
      )}

      <ExploreFilterSheet
        key={JSON.stringify({ ...filters, query: '' })}
        ref={sheet}
        filters={filters}
        districts={districts.data ?? []}
        onApply={(next) => setFilters({ ...next, query: filters.query })}
      />
    </View>
  );
}
