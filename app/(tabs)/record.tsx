import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Chip, HeadlineLg, Text } from '@/components/ui';
import { useStartActivity } from '@/hooks/useStartActivity';
import { tr } from '@/i18n/tr';
import { elapsedSeconds, formatElapsed } from '@/lib/tracking';
import { trackingEngine, useActivity } from '@/stores/activityStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useWizardStore } from '@/stores/wizardStore';
import { colors } from '@/theme/tokens';
import type { ActivityType } from '@/types/routes';

const ACTIVITIES: { key: ActivityType; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'walk', icon: 'directions-walk' },
  { key: 'run', icon: 'directions-run' },
  { key: 'bike', icon: 'directions-bike' },
];

/** Kaydet sekmesi: serbest kayıt başlat, sihirbazla rota üret ya da devam eden kayda dön. */
export default function RecordScreen() {
  const insets = useSafeAreaInsets();
  const snap = useActivity();
  const profile = useSessionStore((s) => s.profile);
  const { start, starting } = useStartActivity();
  const [activity, setActivity] = useState<ActivityType>(profile?.activity_prefs?.[0] ?? 'walk');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const session = snap.session;
  const copy = tr.record;

  const discard = () =>
    Alert.alert(copy.discardConfirmTitle, copy.discardConfirmBody, [
      { text: copy.cancel, style: 'cancel' },
      {
        text: copy.discardConfirm,
        style: 'destructive',
        onPress: () => void trackingEngine.discard(),
      },
    ]);

  const openWizard = () => {
    useWizardStore.getState().reset(profile);
    router.push('/route-wizard/step-1');
  };

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerClassName="gap-space-lg px-margin"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <View className="gap-space-xs">
        <HeadlineLg>{copy.title}</HeadlineLg>
        <Text variant="body-lg" className="text-ink-secondary">
          {copy.subtitle}
        </Text>
      </View>

      {/* Devam eden kayıt */}
      {session ? (
        <Card elevation="raised" className="gap-space-md border-brand p-space-md">
          <View className="flex-row items-center gap-space-sm">
            <View className="h-3 w-3 rounded-full bg-accent" />
            <Text variant="headline-sm">{copy.openTitle}</Text>
          </View>
          <Text variant="body-md" className="text-ink-secondary">
            {copy.openBody(
              tr.wizard.step1.activities[session.activity_type].title,
              formatElapsed(
                elapsedSeconds({
                  startedAt: session.started_at,
                  now,
                  pausedMs: session.paused_ms,
                  pauseStartedAt: session.pause_started_at,
                }),
              ),
            )}
          </Text>
          <Button title={copy.resume} onPress={() => router.push('/activity/live')} />
          <Button title={copy.discard} variant="ghost" onPress={discard} />
        </Card>
      ) : (
        <>
          {/* Serbest kayıt */}
          <Card elevation="raised" className="gap-space-md p-space-md">
            <View className="flex-row items-center gap-space-md">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
                <MaterialIcons name="fiber-manual-record" size={26} color={colors.accent.DEFAULT} />
              </View>
              <View className="flex-1">
                <Text variant="headline-sm">{copy.free}</Text>
                <Text variant="body-md" className="text-ink-secondary">
                  {copy.freeBody}
                </Text>
              </View>
            </View>
            <Text variant="label-caps" className="text-ink-secondary">
              {copy.activity.toUpperCase()}
            </Text>
            <View className="flex-row gap-space-sm">
              {ACTIVITIES.map(({ key, icon }) => (
                <Chip
                  key={key}
                  label={tr.wizard.step1.activities[key].title}
                  selected={activity === key}
                  onPress={() => setActivity(key)}
                  className="flex-1"
                  icon={
                    <MaterialIcons
                      name={icon}
                      size={18}
                      color={activity === key ? colors.brand.DEFAULT : colors.ink.muted}
                    />
                  }
                />
              ))}
            </View>
            <Button
              title={copy.start}
              variant="accent"
              loading={starting}
              leading={<MaterialIcons name="play-arrow" size={22} color="#ffffff" />}
              onPress={() => void start({ activityType: activity })}
            />
          </Card>

          {/* Sihirbaz */}
          <Card className="gap-space-md p-space-md">
            <View className="flex-row items-center gap-space-md">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-soft">
                <MaterialIcons name="route" size={26} color={colors.brand.DEFAULT} />
              </View>
              <View className="flex-1">
                <Text variant="headline-sm">{copy.planned}</Text>
                <Text variant="body-md" className="text-ink-secondary">
                  {copy.plannedBody}
                </Text>
              </View>
            </View>
            <Button title={copy.planned} variant="secondary" onPress={openWizard} />
          </Card>
        </>
      )}
    </ScrollView>
  );
}
