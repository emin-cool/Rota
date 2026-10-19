import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Chip, HeadlineMd, Skeleton, Text } from '@/components/ui';
import { useNowSec } from '@/hooks/useNowSec';
import { tr } from '@/i18n/tr';
import {
  bestWindow,
  conditionFor,
  formatHourRange,
  formatTemp,
  hoursFrom,
  localHour,
  warningsFor,
} from '@/lib/weather';
import { colors } from '@/theme/tokens';
import type { ActivityType } from '@/types/routes';
import type { WeatherResponse } from '../../../supabase/functions/_shared/weather.ts';

const ACTIVITIES: ActivityType[] = ['walk', 'run', 'bike'];
/** Uyarılar için bakılan süre (saat). */
const WARNING_HOURS = 6;
const STRIP_HOURS = 12;

type Props = {
  visible: boolean;
  onClose: () => void;
  data: WeatherResponse | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  usingDefaultLocation: boolean;
  /** Başlangıçta seçili aktivite (profil tercihi). */
  initialActivity?: ActivityType;
};

/** Hava durumu ayrıntısı: şimdiki durum, uyarılar, aktiviteye göre en uygun saat, saatlik şerit. */
export function WeatherSheet({
  visible,
  onClose,
  data,
  loading,
  error,
  onRetry,
  usingDefaultLocation,
  initialActivity = 'walk',
}: Props) {
  const insets = useSafeAreaInsets();
  const copy = tr.weather;
  const [activity, setActivity] = useState<ActivityType>(initialActivity);
  const now = useNowSec();

  const view = useMemo(() => {
    if (!data) return null;
    const w = data.weather;
    return {
      w,
      strip: hoursFrom(w.hourly, now, STRIP_HOURS),
      warnings: warningsFor(hoursFrom(w.hourly, now, WARNING_HOURS)),
      best: bestWindow(w.hourly, now, activity),
    };
  }, [data, activity, now]);

  const current = view?.w.current;
  const condition = current ? conditionFor(current.code, current.isDay) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel={copy.close}
        accessibilityRole="button"
        onPress={onClose}
        className="flex-1 bg-black/35"
      />
      <View
        className="max-h-[85%] rounded-t-3xl bg-canvas px-margin pt-space-md"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <View className="flex-row items-center justify-between pb-space-sm">
          <HeadlineMd>{copy.title}</HeadlineMd>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.close}
            onPress={onClose}
            hitSlop={8}
            className="h-11 w-11 items-center justify-center"
          >
            <MaterialIcons name="close" size={24} color={colors.ink.DEFAULT} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-space-md">
          {loading && !view ? (
            <View className="gap-space-md">
              <Skeleton className="h-[96px] w-full" />
              <Skeleton className="h-[120px] w-full" />
            </View>
          ) : error && !view ? (
            <View className="items-center gap-space-md py-space-lg">
              <Text variant="body-md" className="text-center text-ink-secondary">
                {copy.errorLoad}
              </Text>
              <Button title={tr.common.retry} variant="secondary" onPress={onRetry} />
            </View>
          ) : view && current && condition ? (
            <>
              {/* Şimdiki durum */}
              <Card elevation="raised" className="flex-row items-center gap-space-md p-space-md">
                <MaterialIcons name={condition.icon} size={44} color={colors.accent.deep} />
                <View className="flex-1">
                  <Text variant="metric-numeral">{formatTemp(current.tempC)}</Text>
                  <Text variant="body-md-medium">{condition.label}</Text>
                  <Text variant="label-sm" className="text-ink-secondary">
                    {copy.feelsLike(formatTemp(current.feelsC))} ·{' '}
                    {copy.wind(Math.round(current.windKmh))}
                  </Text>
                </View>
              </Card>
              {data?.stale ? (
                <Text variant="label-sm" className="text-ink-secondary">
                  {copy.stale}
                </Text>
              ) : null}
              <Text variant="label-sm" className="text-ink-secondary">
                {usingDefaultLocation ? copy.defaultLocation : copy.approxLocation}
              </Text>

              {/* Uyarılar */}
              {view.warnings.length > 0 ? (
                <Card className="gap-space-sm bg-accent-soft p-space-md">
                  <View className="flex-row items-center gap-2">
                    <MaterialIcons name="warning" size={18} color={colors.accent.deep} />
                    <Text variant="label-caps" className="text-accent-deep">
                      {copy.warningsTitle.toLocaleUpperCase('tr-TR')}
                    </Text>
                  </View>
                  {view.warnings.map((warning) => (
                    <Text key={warning.kind} variant="body-md">
                      {warning.message}
                    </Text>
                  ))}
                </Card>
              ) : null}

              {/* En uygun saat */}
              <View className="gap-space-sm">
                <View className="flex-row flex-wrap gap-space-sm">
                  {ACTIVITIES.map((a) => (
                    <Chip
                      key={a}
                      label={copy.activity[a]}
                      selected={activity === a}
                      onPress={() => setActivity(a)}
                    />
                  ))}
                </View>
                <Card className="gap-1 p-space-md">
                  <Text variant="label-sm" className="text-ink-secondary">
                    {copy.bestTimeFor(copy.activity[activity])}
                  </Text>
                  {view.best ? (
                    <>
                      <Text variant="headline-sm">
                        {view.best.now
                          ? copy.bestNow
                          : formatHourRange(
                              view.best.startT,
                              view.best.endT,
                              view.w.utcOffsetSeconds,
                            )}
                        {' · '}
                        {copy.quality[view.best.quality]}
                      </Text>
                      {view.best.now ? (
                        <Text variant="label-sm" className="text-ink-secondary">
                          {formatHourRange(
                            view.best.startT,
                            view.best.endT,
                            view.w.utcOffsetSeconds,
                          )}
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <Text variant="body-md">{copy.bestNone}</Text>
                  )}
                  <Text variant="label-sm" className="text-ink-secondary">
                    {copy.bestHint}
                  </Text>
                </Card>
              </View>

              {/* Saatlik şerit */}
              <View className="gap-space-sm">
                <Text variant="headline-sm">{copy.nextHours}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-space-sm">
                    {view.strip.map((h) => {
                      const c = conditionFor(h.code, h.isDay);
                      const hour = localHour(h.t, view.w.utcOffsetSeconds);
                      return (
                        <View
                          key={h.t}
                          accessible
                          accessibilityLabel={`${String(hour).padStart(2, '0')}:00, ${formatTemp(h.tempC)}, ${c.label}`}
                          className="w-[64px] items-center gap-1 rounded-lg border border-hairline bg-white py-space-sm"
                        >
                          <Text variant="label-sm" className="text-ink-secondary">
                            {String(hour).padStart(2, '0')}:00
                          </Text>
                          <MaterialIcons name={c.icon} size={22} color={colors.accent.deep} />
                          <Text variant="body-md-medium">{formatTemp(h.tempC)}</Text>
                          <Text variant="label-sm" className="text-ink-secondary">
                            {h.precipProb > 0 ? copy.rainChance(Math.round(h.precipProb)) : ' '}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              <Text variant="label-sm" className="text-ink-secondary">
                {copy.attribution}
              </Text>
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
