import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  Share,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ResultsMap } from '@/components/route/ResultsMap';
import { RouteResultCard } from '@/components/route/RouteResultCard';
import { HeadlineMd, Text } from '@/components/ui';
import { useStartActivity } from '@/hooks/useStartActivity';
import { tr } from '@/i18n/tr';
import { formatKmValue, routeTitle } from '@/lib/wizard';
import { insertGeneratedRoute, saveGeneratedRoute, unsaveRoute } from '@/lib/routes';
import { freshCourseContext, useCourseSessionStore } from '@/stores/courseSessionStore';
import { useResultsStore } from '@/stores/resultsStore';
import { useSessionStore } from '@/stores/sessionStore';
import { routeColor } from '@/theme/routeColors';
import { colors, shadows } from '@/theme/tokens';

const CARD_GAP = 12;

export default function RouteResultsScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth - 48, 380);
  const snap = cardWidth + CARD_GAP;

  const { input, routes, startName, warnings, selected, savedRouteIds, insertedRouteIds } =
    useResultsStore();
  const select = useResultsStore((s) => s.select);
  const markSaved = useResultsStore((s) => s.markSaved);
  const markInserted = useResultsStore((s) => s.markInserted);
  const userId = useSessionStore((s) => s.session?.user.id);

  const { start: startActivity } = useStartActivity();
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const list = useRef<FlatList>(null);

  // Sonuç yokken (doğrudan açılış, uygulama yeniden başlatma) ana ekrana dön.
  useEffect(() => {
    if (routes.length === 0 || !input) router.replace('/');
  }, [routes.length, input]);

  if (routes.length === 0 || !input) return null;
  const start = routes[0]!.geojson.coordinates[0]!;

  const title = routeTitle(input, startName);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / snap);
    if (i !== selected && i >= 0 && i < routes.length) select(i);
  };

  const selectFromMap = (i: number) => {
    select(i);
    list.current?.scrollToIndex({ index: i, animated: true });
  };

  const toggleSave = async (i: number) => {
    if (!userId || savingIndex !== null) return;
    setSavingIndex(i);
    setSaveError(null);
    try {
      const existing = savedRouteIds[i];
      if (existing) {
        await unsaveRoute(userId, existing);
        markSaved(i, null);
      } else {
        const id = await saveGeneratedRoute({
          userId,
          route: routes[i]!,
          input,
          title: `${routes[i]!.label} • ${title}`,
          existingRouteId: insertedRouteIds[i],
        });
        markInserted(i, id);
        markSaved(i, id);
      }
    } catch {
      setSaveError(tr.results.saveError);
    } finally {
      setSavingIndex(null);
    }
  };

  const beginActivity = async (i: number) => {
    const routeTitleText = `${routes[i]!.label} • ${title}`;
    // Özet ekranında puanlama/fotoğraf/completion_count için rotanın routes'ta olması gerekir.
    // Eklenemezse (internet yok) kayıt yine de başlar; sadece rota bağlantısı olmaz.
    let routeId: string | null = savedRouteIds[i] ?? insertedRouteIds[i] ?? null;
    if (!routeId && userId) {
      try {
        routeId = await insertGeneratedRoute({
          userId,
          route: routes[i]!,
          input,
          title: routeTitleText,
        });
        markInserted(i, routeId);
      } catch {
        routeId = null;
      }
    }
    const course = freshCourseContext();
    await startActivity({
      activityType: input.activityType,
      route: routes[i]!.geojson.coordinates,
      routeTitle: routeTitleText,
      routeId,
      courseDayId: course?.courseDayId ?? null,
      workout: course?.workout ?? null,
    });
    useCourseSessionStore.getState().clear();
  };

  const share = (i: number) => {
    const r = routes[i]!;
    void Share.share({
      message: tr.results.shareMessage(
        `${r.label}: ${title}`,
        formatKmValue(r.distanceM / 1000),
        r.estDurationMin,
      ),
    });
  };

  return (
    <View className="flex-1 bg-canvas">
      {/* Harita */}
      <View className="flex-1">
        <ResultsMap
          routes={routes}
          selected={selected}
          start={[start[0], start[1]]}
          startName={startName}
          onSelect={selectFromMap}
        />
        <View
          pointerEvents="box-none"
          className="absolute inset-x-0 top-0 flex-row items-center justify-between px-space-sm"
          style={{ paddingTop: insets.top + 8 }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr.wizard.back}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            className="h-11 w-11 items-center justify-center rounded-full bg-white/90"
            style={shadows.level2}
          >
            <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.ink.DEFAULT} />
          </Pressable>
          <View className="rounded-full bg-white/90 px-4 py-2" style={shadows.level2}>
            <Text variant="body-md-medium" className="font-bold" accessibilityRole="header">
              {tr.results.title}
            </Text>
          </View>
          <View className="h-11 w-11" />
        </View>
      </View>

      {/* Kartlar */}
      <View
        className="gap-space-sm pt-space-md"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <View className="flex-row items-center justify-between px-margin">
          <View className="flex-row items-center gap-space-sm">
            <View
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: routeColor(selected) }}
            />
            <HeadlineMd className="text-headline-sm">{tr.results.found(routes.length)}</HeadlineMd>
          </View>
          <View className="rounded-full bg-surface-container px-3 py-1">
            <Text variant="label-sm" className="font-bold text-ink-secondary">
              {tr.results.pageOf(selected + 1, routes.length)}
            </Text>
          </View>
        </View>

        {warnings.includes('scenery_unavailable') ? (
          <Text variant="label-sm" className="px-margin text-ink-secondary">
            {tr.results.scenerySoft}
          </Text>
        ) : null}
        {saveError ? (
          <Text
            variant="label-sm"
            className="px-margin text-error"
            accessibilityLiveRegion="polite"
          >
            {saveError}
          </Text>
        ) : null}

        <FlatList
          ref={list}
          horizontal
          data={routes}
          keyExtractor={(r, i) => `${r.label}-${i}`}
          showsHorizontalScrollIndicator={false}
          snapToInterval={snap}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: 24, gap: CARD_GAP, paddingBottom: 8 }}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_, i) => ({ length: snap, offset: snap * i, index: i })}
          renderItem={({ item, index }) => (
            <RouteResultCard
              route={item}
              index={index}
              title={title}
              width={cardWidth}
              saved={!!savedRouteIds[index]}
              saving={savingIndex === index}
              onStart={() => void beginActivity(index)}
              onSave={() => void toggleSave(index)}
              onShare={() => share(index)}
            />
          )}
        />

        <View className="flex-row justify-center gap-2">
          {routes.map((_, i) => (
            <View
              key={i}
              className="h-1.5 rounded-full"
              style={{
                width: i === selected ? 28 : 8,
                backgroundColor:
                  i === selected ? colors.brand.DEFAULT : colors['surface-container-high'],
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
