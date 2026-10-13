import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StepHeader } from '@/components/StepHeader';
import { Button, HeadlineLg, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { useSessionStore } from '@/stores/sessionStore';
import { colors } from '@/theme/tokens';

export default function LocationPermissionScreen() {
  const insets = useSafeAreaInsets();
  const patchProfile = useSessionStore((s) => s.patchProfile);
  const [busy, setBusy] = useState<'allow' | 'skip' | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Onboarding'i bitir → kök layout korumaları kullanıcıyı ana sekmelere alır. */
  const finish = async () => {
    await patchProfile({ onboarding_completed: true });
  };

  const run = async (kind: 'allow' | 'skip') => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'allow') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setDenied(true);
        }
      }
      await finish();
    } catch {
      setError(tr.location.saveError);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <StepHeader step={2} total={2} label={tr.onboarding.stepProfile} showBack />

      <View className="flex-1 items-center justify-center gap-space-lg px-margin">
        <View className="h-28 w-28 items-center justify-center rounded-full bg-brand-soft">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-brand">
            <MaterialIcons name="place" size={40} color={colors.white} />
          </View>
        </View>

        <View className="items-center gap-space-sm">
          <HeadlineLg className="text-center">{tr.location.title}</HeadlineLg>
          <Text variant="body-lg" className="text-center text-ink-secondary">
            {tr.location.subtitle}
          </Text>
        </View>

        <View className="w-full gap-space-sm">
          {tr.location.points.map((point) => (
            <View key={point} className="flex-row items-start gap-space-sm">
              <MaterialIcons name="check-circle" size={20} color={colors.brand.DEFAULT} />
              <Text variant="body-md" className="flex-1 text-ink-secondary">
                {point}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View
        className="gap-space-sm px-margin pt-space-md"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        {denied ? (
          <Text variant="body-md" className="text-center text-ink-secondary">
            {tr.location.deniedNote}
          </Text>
        ) : null}
        {error ? (
          <Text
            variant="body-md"
            className="text-center text-error"
            accessibilityLiveRegion="polite"
          >
            {error}
          </Text>
        ) : null}
        <Button
          title={tr.location.allow}
          loading={busy === 'allow'}
          disabled={busy !== null}
          onPress={() => void run('allow')}
        />
        <Button
          title={tr.location.skip}
          variant="ghost"
          loading={busy === 'skip'}
          disabled={busy !== null}
          onPress={() => void run('skip')}
        />
      </View>
    </View>
  );
}
