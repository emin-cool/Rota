import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { MapPointPicker } from '@/components/wizard/MapPointPicker';
import { WizardScaffold } from '@/components/wizard/WizardScaffold';
import { useUserLocation } from '@/hooks/useUserLocation';
import { tr } from '@/i18n/tr';
import { haversineM } from '@/lib/geo';
import { reverseGeocode } from '@/lib/geocode';
import type { LngLat } from '@/lib/geo';
import { DEFAULT_CENTER } from '@/lib/mapConfig';
import { useWizardStore } from '@/stores/wizardStore';
import { colors, shadows } from '@/theme/tokens';

type Active = 'start' | 'end';

/** Bu mesafeden yakın bir "yeni merkez" aynı nokta sayılır (harita durma titreşimi). */
const SAME_POINT_M = 15;
/** A→B'de başlangıç ve bitiş en az bu kadar ayrı olmalı. */
const MIN_AB_DISTANCE_M = 200;

export default function WizardStep2() {
  const insets = useSafeAreaInsets();
  const location = useUserLocation();
  const copy = tr.wizard.step2;

  const routeType = useWizardStore((s) => s.routeType);
  const start = useWizardStore((s) => s.start);
  const end = useWizardStore((s) => s.end);
  const startLabel = useWizardStore((s) => s.startLabel);
  const endLabel = useWizardStore((s) => s.endLabel);
  const patch = useWizardStore((s) => s.patch);

  const isAB = routeType === 'a_b';
  const [active, setActive] = useState<Active>('start');
  const [fly, setFly] = useState<{ point: LngLat; key: number } | null>(null);
  const flyKey = useRef(0);
  /** Haritanın en son bildirilen merkezi (nokta atanmasa bile): sekme değişince hemen kullanılır. */
  const lastCenter = useRef<LngLat | null>(null);
  const goTo = (point: LngLat) => setFly({ point, key: ++flyKey.current });
  // Harita yalnızca ilk açılışta bu merkeze ortalanır; sonrası `flyTo` ile.
  const [initialCenter] = useState<LngLat>(() => start ?? location.coords ?? DEFAULT_CENTER);

  // Konum sonradan gelirse ve henüz başlangıç seçilmediyse: mevcut konumu başlangıç yap.
  useEffect(() => {
    const { startIsCurrent, start: s } = useWizardStore.getState();
    if (location.coords && startIsCurrent && !s) {
      patch({ start: location.coords, startLabel: null });
      goTo(location.coords);
    }
  }, [location.coords, patch]);

  const onCenterChange = (c: LngLat) => {
    lastCenter.current = c;
    const s = useWizardStore.getState();
    const stored = active === 'start' ? s.start : s.end;
    if (stored && haversineM(stored, c) < SAME_POINT_M) return;
    if (active === 'start') patch({ start: c, startIsCurrent: false, startLabel: null });
    else patch({ end: c, endLabel: null });
  };

  // Seçilen noktanın yer adı (Mapbox ters kodlama), harita durduktan kısa süre sonra.
  // Yer adı aranıyor mu? Etiket yokken ve arama henüz başarısız olmadıysa evet.
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const activePoint = active === 'start' ? start : end;
  const activeLabel = active === 'start' ? startLabel : endLabel;
  const pointKey = activePoint ? `${active}:${activePoint[0]},${activePoint[1]}` : null;
  const searching = !!activePoint && !activeLabel && failedKey !== pointKey;

  useEffect(() => {
    if (!activePoint || activeLabel) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const name = await reverseGeocode(activePoint, controller.signal);
      if (controller.signal.aborted) return;
      if (name) patch(active === 'start' ? { startLabel: name } : { endLabel: name });
      else setFailedKey(pointKey);
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [activePoint, activeLabel, active, patch, pointKey]);

  const switchTo = (next: Active) => {
    setActive(next);
    const target = next === 'start' ? start : end;
    if (target) {
      goTo(target);
    } else if (next === 'end' && lastCenter.current) {
      // Harita kıpırdamayacağı için "durdu" olayı gelmez; bitişi hemen haritanın merkezi yap.
      patch({ end: lastCenter.current, endLabel: null });
    }
  };

  const useCurrent = () => {
    if (!location.coords) return;
    patch({ start: location.coords, startIsCurrent: true, startLabel: null });
    setActive('start');
    goTo(location.coords);
  };

  const abTooClose = isAB && !!start && !!end && haversineM(start, end) < MIN_AB_DISTANCE_M;
  const canContinue = !!start && (!isAB || (!!end && !abTooClose));
  const pinColor = active === 'start' ? colors.brand.DEFAULT : colors.accent.DEFAULT;
  const startIsCurrent = useWizardStore((s) => s.startIsCurrent);

  return (
    <WizardScaffold
      step={2}
      badge={copy.badge}
      heading={copy.title}
      subtitle={isAB ? copy.subtitleAB : copy.subtitleLoop}
      scroll={false}
      onNext={() => router.push('/route-wizard/step-3')}
      nextDisabled={!canContinue}
    >
      <View className="flex-1">
        {isAB ? (
          <View className="mx-margin mb-space-sm flex-row gap-space-sm rounded-full bg-surface-container p-1">
            {(['start', 'end'] as const).map((k) => (
              <Pressable
                key={k}
                accessibilityRole="tab"
                accessibilityState={{ selected: active === k }}
                onPress={() => switchTo(k)}
                className={`h-10 flex-1 items-center justify-center rounded-full ${
                  active === k ? 'bg-white' : ''
                }`}
              >
                <Text
                  variant="body-md-medium"
                  className={active === k ? 'font-bold text-brand' : 'text-ink-secondary'}
                >
                  {k === 'start' ? copy.start : copy.end}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View className="flex-1 overflow-hidden">
          <MapPointPicker
            initialCenter={initialCenter}
            onCenterChange={onCenterChange}
            flyTo={fly}
            pinColor={pinColor}
            fixedPoints={
              isAB && active === 'end' && start
                ? [{ point: start, color: colors.brand.DEFAULT }]
                : []
            }
            showUserLocation={location.status === 'granted'}
          />

          {/* Seçilen nokta kartı */}
          <View
            className="absolute inset-x-margin gap-space-sm rounded-lg bg-white p-space-md"
            style={[{ bottom: 12 + Math.min(insets.bottom, 8) }, shadows.level2]}
          >
            <View className="flex-row items-center gap-space-sm">
              <MaterialIcons name="place" size={22} color={pinColor} />
              <View className="flex-1">
                <Text variant="label-caps" className="text-ink-secondary">
                  {isAB
                    ? (active === 'start' ? copy.start : copy.end).toUpperCase()
                    : copy.start.toUpperCase()}
                </Text>
                <Text variant="body-lg" className="font-bold" numberOfLines={1}>
                  {activeLabel ??
                    (activePoint ? (searching ? copy.searching : copy.selectedPoint) : '…')}
                </Text>
              </View>
              {location.coords && active === 'start' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.useCurrent}
                  onPress={useCurrent}
                  className={`min-h-[44px] flex-row items-center gap-1 rounded-full px-3 ${
                    startIsCurrent ? 'bg-brand' : 'bg-brand-soft'
                  }`}
                >
                  <MaterialIcons
                    name="my-location"
                    size={18}
                    color={startIsCurrent ? '#ffffff' : colors.brand.DEFAULT}
                  />
                  <Text
                    variant="label-sm"
                    className={startIsCurrent ? 'font-bold text-white' : 'font-bold text-brand'}
                  >
                    {copy.useCurrent}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {location.status === 'denied' ? (
              <Text variant="label-sm" className="text-ink-secondary">
                {copy.noLocation}
              </Text>
            ) : null}
            {abTooClose ? (
              <Text
                variant="label-sm"
                className="text-accent-deep"
                accessibilityLiveRegion="polite"
              >
                {copy.tooClose}
              </Text>
            ) : null}
            {isAB && !end && active === 'start' ? (
              <Text variant="label-sm" className="text-ink-secondary">
                {copy.needEnd}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </WizardScaffold>
  );
}
