import { MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StepHeader } from '@/components/StepHeader';
import { Button, Card, HeadlineMd, HeadlineLg, Metric, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import {
  DEFAULT_RUN_PACE_SEC,
  PACE_MAX_SEC,
  PACE_MIN_SEC,
  formatPace,
  paceLabel,
} from '@/lib/pace';
import { useSessionStore } from '@/stores/sessionStore';
import { colors } from '@/theme/tokens';
import type { ActivityType, Level } from '@/types/database';

const ACTIVITIES: { key: ActivityType; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'walk', icon: 'directions-walk' },
  { key: 'run', icon: 'directions-run' },
  { key: 'bike', icon: 'directions-bike' },
];

const LEVELS: { key: Level; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'beginner', icon: 'spa' },
  { key: 'intermediate', icon: 'show-chart' },
  { key: 'advanced', icon: 'local-fire-department' },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const profile = useSessionStore((s) => s.profile);
  const patchProfile = useSessionStore((s) => s.patchProfile);

  const [activities, setActivities] = useState<ActivityType[]>(profile?.activity_prefs ?? []);
  const [level, setLevel] = useState<Level | null>(profile?.level ?? null);
  const [pace, setPace] = useState(profile?.default_pace_sec_per_km ?? DEFAULT_RUN_PACE_SEC);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSelected = activities.includes('run');
  const canContinue = activities.length > 0 && level !== null;

  const toggle = (a: ActivityType) =>
    setActivities((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));

  const next = async () => {
    if (!canContinue) return;
    setSaving(true);
    setError(null);
    try {
      await patchProfile({
        activity_prefs: activities,
        level,
        default_pace_sec_per_km: runSelected ? pace : null,
      });
      router.push('/location');
    } catch {
      setError(tr.onboarding.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <StepHeader step={1} total={2} label={tr.onboarding.stepProfile} />

      <ScrollView
        contentContainerClassName="gap-space-lg px-margin pt-space-md"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="gap-space-xs">
          <HeadlineLg>{tr.onboarding.title}</HeadlineLg>
          <Text variant="body-lg" className="text-ink-secondary">
            {tr.onboarding.subtitle}
          </Text>
        </View>

        {/* Aktiviteler (çoklu seçim) */}
        <View className="gap-space-md">
          <View className="flex-row items-center justify-between">
            <HeadlineMd className="text-headline-sm">{tr.onboarding.activitiesTitle}</HeadlineMd>
            <Text variant="label-sm" className="font-bold text-brand">
              {tr.onboarding.multiSelect}
            </Text>
          </View>
          {ACTIVITIES.map(({ key, icon }) => {
            const selected = activities.includes(key);
            const copy = tr.onboarding.activities[key];
            return (
              <Pressable
                key={key}
                accessibilityRole="checkbox"
                accessibilityLabel={copy.title}
                accessibilityState={{ checked: selected }}
                onPress={() => toggle(key)}
                className={`min-h-[72px] flex-row items-center gap-space-md rounded-lg border-[1.5px] p-space-md ${
                  selected ? 'border-brand bg-brand-soft' : 'border-hairline bg-white'
                }`}
              >
                <View
                  className={`h-12 w-12 items-center justify-center rounded-md ${
                    selected ? 'bg-brand' : 'bg-surface-container'
                  }`}
                >
                  <MaterialIcons
                    name={icon}
                    size={26}
                    color={selected ? '#ffffff' : colors['on-surface-variant']}
                  />
                </View>
                <View className="flex-1">
                  <Text variant="headline-sm">{copy.title}</Text>
                  <Text variant="body-md" className="text-ink-secondary">
                    {copy.subtitle}
                  </Text>
                </View>
                <View
                  className={`h-7 w-7 items-center justify-center rounded-full ${
                    selected ? 'bg-brand' : 'bg-surface-container'
                  }`}
                >
                  <MaterialIcons
                    name={selected ? 'check' : 'add'}
                    size={18}
                    color={selected ? '#ffffff' : colors.ink.muted}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Seviye */}
        <View className="gap-space-md">
          <View className="gap-1">
            <HeadlineMd className="text-headline-sm">{tr.onboarding.levelTitle}</HeadlineMd>
            <Text variant="body-md" className="text-ink-secondary">
              {tr.onboarding.levelSubtitle}
            </Text>
          </View>
          <View
            accessibilityRole="radiogroup"
            className="flex-row gap-space-sm rounded-lg bg-surface-container p-1"
          >
            {LEVELS.map(({ key, icon }) => {
              const selected = level === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityLabel={tr.onboarding.levels[key]}
                  accessibilityState={{ selected }}
                  onPress={() => setLevel(key)}
                  className={`min-h-[84px] flex-1 items-center justify-center gap-1 rounded-md px-1 ${
                    selected ? 'bg-brand' : ''
                  }`}
                >
                  <MaterialIcons
                    name={icon}
                    size={22}
                    color={selected ? '#ffffff' : colors['on-surface-variant']}
                  />
                  <Text
                    variant="label-sm"
                    className={`text-center font-bold ${selected ? 'text-white' : 'text-ink-secondary'}`}
                  >
                    {tr.onboarding.levels[key]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Koşu temposu — sadece koşu seçiliyse */}
        {runSelected ? (
          <View className="gap-space-md">
            <View className="flex-row items-center justify-between">
              <HeadlineMd className="text-headline-sm">{tr.onboarding.paceTitle}</HeadlineMd>
              <Text variant="label-sm" className="text-ink-muted">
                {tr.onboarding.optional}
              </Text>
            </View>
            <Card elevation="raised" className="gap-space-sm p-space-md">
              <View className="flex-row items-start justify-between">
                <Text variant="label-caps" className="text-ink-secondary">
                  {tr.onboarding.targetPace}
                </Text>
                <View className="rounded-full bg-primary-fixed px-3 py-1">
                  <Text variant="label-sm" className="font-bold text-on-primary-fixed-variant">
                    {tr.onboarding.paceBadge[paceLabel(pace)]}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-baseline gap-space-sm">
                <Metric className="text-brand">{formatPace(pace)}</Metric>
                <Text variant="body-md" className="text-ink-muted">
                  {tr.onboarding.paceUnit}
                </Text>
              </View>
              <Slider
                accessibilityLabel={tr.onboarding.paceTitle}
                accessibilityValue={{ text: `${formatPace(pace)} ${tr.onboarding.paceUnit}` }}
                minimumValue={PACE_MIN_SEC}
                maximumValue={PACE_MAX_SEC}
                step={5}
                value={pace}
                onValueChange={setPace}
                minimumTrackTintColor={colors.brand.DEFAULT}
                maximumTrackTintColor={colors.brand.soft}
                thumbTintColor={colors.brand.DEFAULT}
                style={{ height: 44 }}
              />
              <View className="flex-row justify-between">
                <Text variant="label-sm" className="text-ink-secondary">
                  {formatPace(PACE_MIN_SEC)} ({tr.onboarding.paceFast})
                </Text>
                <Text variant="label-sm" className="text-ink-secondary">
                  {formatPace(PACE_MAX_SEC)} ({tr.onboarding.paceEasy})
                </Text>
              </View>
            </Card>
          </View>
        ) : null}
      </ScrollView>

      <View
        className="gap-space-sm border-t border-hairline bg-canvas px-margin pt-space-md"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        {error ? (
          <Text variant="body-md" className="text-error" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button
          title={tr.common.continue}
          loading={saving}
          disabled={!canContinue}
          leading={<MaterialIcons name="arrow-forward" size={20} color="#ffffff" />}
          onPress={() => void next()}
        />
        <Text variant="label-sm" className="text-center text-ink-secondary">
          {tr.onboarding.later}
        </Text>
      </View>
    </View>
  );
}
