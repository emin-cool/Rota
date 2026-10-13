import { MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapPointPicker } from '@/components/wizard/MapPointPicker';
import { Button, HeadlineMd, Text } from '@/components/ui';
import { usePrivacyZone } from '@/hooks/useProfileQueries';
import { useUserLocation } from '@/hooks/useUserLocation';
import { tr } from '@/i18n/tr';
import type { LngLat } from '@/lib/geo';
import { DEFAULT_CENTER } from '@/lib/mapConfig';
import { removePrivacyZone, savePrivacyZone } from '@/lib/profileApi';
import { colors } from '@/theme/tokens';

const MIN_R = 200;
const MAX_R = 500;

type Ready = { initialCenter: LngLat; initialRadius: number; hasZone: boolean };

function PrivacyZoneEditor({ initialCenter, initialRadius, hasZone }: Ready) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const location = useUserLocation();
  const [center, setCenter] = useState<LngLat>(initialCenter);
  const [radius, setRadius] = useState(initialRadius);
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [error, setError] = useState(false);

  const finish = async (message: string) => {
    await qc.invalidateQueries({ queryKey: ['privacy-zone'] });
    Alert.alert(message);
    router.back();
  };

  const save = async () => {
    setBusy('save');
    setError(false);
    try {
      await savePrivacyZone(center[0], center[1], radius);
      await finish(tr.privacyZone.saved);
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('remove');
    setError(false);
    try {
      await removePrivacyZone();
      await finish(tr.privacyZone.removed);
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="flex-1">
      <View className="flex-1 overflow-hidden">
        <MapPointPicker
          initialCenter={initialCenter}
          onCenterChange={setCenter}
          flyTo={null}
          pinColor={colors.brand.DEFAULT}
          fixedPoints={[]}
          showUserLocation={location.status === 'granted'}
          radiusM={radius}
        />
      </View>
      <View
        className="gap-space-md border-t border-hairline bg-canvas px-margin pt-space-md"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <View className="flex-row items-center justify-between">
          <Text variant="body-lg" className="font-bold">
            {tr.privacyZone.radius}
          </Text>
          <Text variant="headline-sm" className="text-brand">
            {tr.privacyZone.radiusM(radius)}
          </Text>
        </View>
        <Slider
          minimumValue={MIN_R}
          maximumValue={MAX_R}
          step={50}
          value={radius}
          onValueChange={setRadius}
          minimumTrackTintColor={colors.brand.DEFAULT}
          maximumTrackTintColor={colors.hairline}
          thumbTintColor={colors.brand.DEFAULT}
          accessibilityLabel={tr.privacyZone.radius}
        />
        <Text variant="label-sm" className="text-ink-secondary">
          {tr.privacyZone.note}
        </Text>
        {error ? (
          <Text variant="body-md" className="text-center text-error">
            {tr.privacyZone.saveError}
          </Text>
        ) : null}
        <View className="flex-row gap-space-md">
          {hasZone ? (
            <Button
              title={tr.privacyZone.remove}
              variant="secondary"
              loading={busy === 'remove'}
              disabled={busy !== null}
              onPress={() => void remove()}
              className="flex-1"
            />
          ) : null}
          <Button
            title={busy === 'save' ? tr.privacyZone.saving : tr.privacyZone.save}
            loading={busy === 'save'}
            disabled={busy !== null}
            onPress={() => void save()}
            className="flex-[1.6]"
          />
        </View>
      </View>
    </View>
  );
}

export default function PrivacyZoneScreen() {
  const insets = useSafeAreaInsets();
  const zone = usePrivacyZone();
  const location = useUserLocation();

  const header = (
    <View
      className="flex-row items-center justify-between px-space-sm pb-space-sm"
      style={{ paddingTop: insets.top + 4 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr.common.back}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={8}
        className="h-11 w-11 items-center justify-center"
      >
        <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.ink.DEFAULT} />
      </Pressable>
      <HeadlineMd>{tr.privacyZone.title}</HeadlineMd>
      <View className="h-11 w-11" />
    </View>
  );

  // Harita başlangıç noktası yalnızca ilk açılışta kullanıldığı için bölge ve konum hazır olunca kurulur.
  const loading = zone.isPending || location.status === 'loading';

  return (
    <View className="flex-1 bg-canvas">
      {header}
      <Text variant="body-md" className="px-margin pb-space-sm text-ink-secondary">
        {tr.privacyZone.intro}
      </Text>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand.DEFAULT} />
        </View>
      ) : zone.isError ? (
        <View className="items-center gap-space-md px-margin py-space-xl">
          <Text variant="body-md" className="text-center">
            {tr.privacyZone.loadError}
          </Text>
          <Button title={tr.common.retry} variant="secondary" onPress={() => void zone.refetch()} />
        </View>
      ) : (
        <PrivacyZoneEditor
          initialCenter={
            zone.data ? [zone.data.lng, zone.data.lat] : (location.coords ?? DEFAULT_CENTER)
          }
          initialRadius={Math.min(MAX_R, Math.max(MIN_R, zone.data?.radius_m ?? 300))}
          hasZone={!!zone.data}
        />
      )}
    </View>
  );
}
