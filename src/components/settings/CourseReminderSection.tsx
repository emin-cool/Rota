import { MaterialIcons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Alert, Linking, Pressable, Switch, View } from 'react-native';

import { Card, Chip, Text } from '@/components/ui';
import { usePushPermission } from '@/hooks/useNotificationSettings';
import { getPushPermission } from '@/lib/push';
import { tr } from '@/i18n/tr';
import { formatReminderTime, stepTime, toggleWeekday, type IsoWeekday } from '@/lib/courseReminder';
import { useCourseReminderStore } from '@/stores/courseReminderStore';
import { colors } from '@/theme/tokens';

const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

function Stepper({
  label,
  value,
  upLabel,
  downLabel,
  onUp,
  onDown,
}: {
  label: string;
  value: string;
  upLabel: string;
  downLabel: string;
  onUp: () => void;
  onDown: () => void;
}) {
  const btn =
    'h-11 w-11 items-center justify-center rounded-full bg-brand-soft active:bg-primary-fixed';
  return (
    <View className="flex-1 items-center gap-space-xs">
      <Text variant="label-sm" className="text-ink-secondary">
        {label}
      </Text>
      <View className="flex-row items-center gap-space-sm">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={downLabel}
          onPress={onDown}
          className={btn}
        >
          <MaterialIcons name="remove" size={22} color={colors.brand.DEFAULT} />
        </Pressable>
        <Text variant="headline-md" style={{ fontVariant: ['tabular-nums'] }}>
          {value}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={upLabel}
          onPress={onUp}
          className={btn}
        >
          <MaterialIcons name="add" size={22} color={colors.brand.DEFAULT} />
        </Pressable>
      </View>
    </View>
  );
}

/** Ayarlar → Kurs hatırlatıcısı: aç/kapa, saat ve gün seçimi (bu cihazda, yerel bildirim). */
export function CourseReminderSection() {
  const copy = tr.courseReminder;
  const { settings, loaded, load, update } = useCourseReminderStore();
  const { permission, request } = usePushPermission();

  useEffect(() => {
    void load();
  }, [load]);

  // Yerel bildirimler yalnızca gerçek cihazda çalışır (simülatör / web'de bölüm gizlenir).
  if (permission === null || permission === 'unavailable' || !loaded) return null;

  const toggle = async (value: boolean) => {
    if (value && permission !== 'granted') {
      if (permission === 'undetermined') await request();
      const next = await getPushPermission();
      if (next !== 'granted') {
        Alert.alert(copy.permissionAlertTitle, copy.permissionAlertBody, [
          { text: copy.cancel, style: 'cancel' },
          { text: copy.openSettings, onPress: () => void Linking.openSettings() },
        ]);
        return;
      }
    }
    await update({ enabled: value });
  };

  return (
    <View className="gap-space-md">
      <Text variant="label-caps" className="px-space-xs text-ink-secondary">
        {copy.section}
      </Text>
      <Card className="gap-space-md p-space-md">
        <View className="flex-row items-center gap-space-md">
          <View className="flex-1">
            <Text variant="body-lg" className="font-bold">
              {copy.toggle}
            </Text>
            <Text variant="label-sm" className="text-ink-secondary">
              {copy.toggleHint}
            </Text>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={(v) => void toggle(v)}
            trackColor={{ true: colors.brand.DEFAULT, false: colors.hairline }}
            accessibilityLabel={copy.toggle}
          />
        </View>

        {settings.enabled ? (
          <>
            <View
              className="flex-row items-start"
              accessibilityLabel={`${copy.time} ${formatReminderTime(settings)}`}
            >
              <Stepper
                label={copy.hour}
                value={String(settings.hour).padStart(2, '0')}
                upLabel={copy.hourUp}
                downLabel={copy.hourDown}
                onUp={() => void update(stepTime(settings, 'hour', 1))}
                onDown={() => void update(stepTime(settings, 'hour', -1))}
              />
              <Stepper
                label={copy.minute}
                value={String(settings.minute).padStart(2, '0')}
                upLabel={copy.minuteUp}
                downLabel={copy.minuteDown}
                onUp={() => void update(stepTime(settings, 'minute', 1))}
                onDown={() => void update(stepTime(settings, 'minute', -1))}
              />
            </View>

            <View className="gap-space-sm">
              <Text variant="label-sm" className="text-ink-secondary">
                {copy.days}
              </Text>
              <View className="flex-row flex-wrap gap-space-sm">
                {WEEKDAYS.map((d) => (
                  <Chip
                    key={d}
                    label={copy.dayShort[d - 1]!}
                    accessibilityLabel={copy.dayLong[d - 1]}
                    selected={settings.weekdays.includes(d)}
                    onPress={() => void update({ weekdays: toggleWeekday(settings.weekdays, d) })}
                  />
                ))}
              </View>
              {settings.weekdays.length === 0 ? (
                <Text variant="label-sm" className="text-error">
                  {copy.noDays}
                </Text>
              ) : null}
            </View>
            <Text variant="label-sm" className="text-ink-secondary">
              {copy.noProgram}
            </Text>
          </>
        ) : null}
      </Card>
    </View>
  );
}
