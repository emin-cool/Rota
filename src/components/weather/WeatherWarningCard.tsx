import { MaterialIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { useNowSec } from '@/hooks/useNowSec';
import { tr } from '@/i18n/tr';
import { bestWindow, formatHourRange, hoursFrom, warningsFor } from '@/lib/weather';
import { colors } from '@/theme/tokens';
import type { ActivityType } from '@/types/routes';
import type { WeatherData } from '../../../supabase/functions/_shared/weather.ts';

const WARNING_HOURS = 6;
/** Kartta en çok bu kadar uyarı satırı gösterilir. */
const MAX_LINES = 2;

/**
 * Sihirbazda, önümüzdeki saatlerde dikkat gerektiren hava varsa kısa uyarı kartı. Sakin havada
 * hiçbir şey çizmez; tahmin yoksa (yükleniyor/hata) de sessizdir: hava durumu akışı engellemez.
 */
export function WeatherWarningCard({
  weather,
  activity,
}: {
  weather: WeatherData | undefined;
  activity: ActivityType;
}) {
  const now = useNowSec();
  const info = useMemo(() => {
    if (!weather) return null;
    const warnings = warningsFor(hoursFrom(weather.hourly, now, WARNING_HOURS));
    if (warnings.length === 0) return null;
    const best = bestWindow(weather.hourly, now, activity);
    return { warnings: warnings.slice(0, MAX_LINES), best };
  }, [weather, activity, now]);

  if (!info || !weather) return null;
  const later =
    info.best && !info.best.now
      ? `${tr.weather.bestTime}: ${formatHourRange(info.best.startT, info.best.endT, weather.utcOffsetSeconds)}`
      : null;

  return (
    <Card className="gap-space-xs bg-accent-soft p-space-md" accessibilityLiveRegion="polite">
      <View className="flex-row items-center gap-2">
        <MaterialIcons name="warning" size={18} color={colors.accent.deep} />
        <Text variant="label-caps" className="text-accent-deep">
          {tr.weather.wizard.title.toLocaleUpperCase('tr-TR')}
        </Text>
      </View>
      {info.warnings.map((w) => (
        <Text key={w.kind} variant="body-md">
          {w.message}
        </Text>
      ))}
      {later ? (
        <Text variant="label-sm" className="text-ink-secondary">
          {tr.weather.wizard.later} {later}
        </Text>
      ) : null}
    </Card>
  );
}
