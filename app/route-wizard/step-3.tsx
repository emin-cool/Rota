import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { RouteSuggestionCard } from '@/components/wizard/controls';
import { DurationRing } from '@/components/wizard/DurationRing';
import { WizardScaffold } from '@/components/wizard/WizardScaffold';
import { useWizardNearby } from '@/hooks/useWizardNearby';
import { tr } from '@/i18n/tr';
import { formatDistance, haversineM } from '@/lib/geo';
import {
  DISTANCE_LIMITS,
  DURATION_LIMITS,
  QUICK_DISTANCES_KM,
  QUICK_DURATIONS_MIN,
  estimateKm,
  estimateMinutes,
  formatClock,
  formatKmValue,
  pickRecommendations,
  quickChipKm,
  routeMeta,
  stepDistance,
  stepDuration,
} from '@/lib/wizard';
import { selectAnswers, useWizardStore } from '@/stores/wizardStore';
import { suggestionGradients } from '@/theme/gradients';
import { colors, shadows } from '@/theme/tokens';

/** Yol/kuş uçuşu oranı: A→B'de iki nokta arası tahmini yürünebilir mesafe. */
const AB_CIRCUITY = 1.3;

function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: 'remove' | 'add';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-14 w-14 items-center justify-center rounded-full bg-surface-container active:bg-surface-container-high"
    >
      <MaterialIcons name={icon} size={28} color={colors.brand.DEFAULT} />
    </Pressable>
  );
}

export default function WizardStep3() {
  const a = useWizardStore(selectAnswers);
  const patch = useWizardStore((s) => s.patch);
  const { routes } = useWizardNearby();
  const { recommended, nature } = pickRecommendations(routes);
  const copy = tr.wizard.step3;
  const isAB = a.routeType === 'a_b';

  const goNext = () => router.push('/route-wizard/step-4');

  // A→B: hedef süre/mesafe yok, yol iki nokta arasındaki en iyi güzergâhla belirlenir.
  if (isAB) {
    const straight = a.start && a.end ? haversineM(a.start, a.end) : 0;
    const walkable = straight * AB_CIRCUITY;
    const minutes = estimateMinutes(a.activityType, walkable / 1000, a.slope, a.paceSecPerKm);
    return (
      <WizardScaffold
        step={3}
        badge={copy.badge}
        heading={tr.wizard.step1.routeTypes.a_b.title}
        onNext={goNext}
      >
        <View
          className="items-center gap-space-md rounded-lg bg-white p-space-lg"
          style={shadows.level1}
        >
          <MaterialIcons name="route" size={40} color={colors.brand.DEFAULT} />
          <Text variant="headline-sm" className="text-center">
            {a.start && a.end ? `≈ ${formatDistance(walkable)} • ${formatClock(minutes)}` : '—'}
          </Text>
          <Text variant="body-md" className="text-center text-ink-secondary">
            {copy.abInfo}
          </Text>
        </View>
      </WizardScaffold>
    );
  }

  const isDuration = a.goal === 'duration';
  const limits = isDuration ? DURATION_LIMITS[a.activityType] : DISTANCE_LIMITS[a.activityType];
  const value = isDuration ? a.durationMin : a.distanceKm;
  const fraction = value / limits.max;

  const bigText = isDuration ? formatClock(a.durationMin) : `${formatKmValue(a.distanceKm)} km`;
  const helper = isDuration
    ? copy.approxKm(
        `${formatKmValue(estimateKm(a.activityType, a.durationMin, a.slope, a.paceSecPerKm))} km`,
        copy.activityWord[a.activityType],
      )
    : copy.approxMin(
        formatClock(estimateMinutes(a.activityType, a.distanceKm, a.slope, a.paceSecPerKm)),
      );

  const change = (dir: 1 | -1) =>
    patch(
      isDuration ? { durationMin: stepDuration(a, dir) } : { distanceKm: stepDistance(a, dir) },
    );

  return (
    <WizardScaffold
      step={3}
      badge={copy.badge}
      heading={copy.title}
      subtitle={copy.subtitle}
      onNext={goNext}
    >
      {/* Süre | Mesafe */}
      <View
        accessibilityRole="tablist"
        className="h-14 flex-row rounded-full bg-surface-container p-1"
      >
        {(['duration', 'distance'] as const).map((g) => (
          <Pressable
            key={g}
            accessibilityRole="tab"
            accessibilityState={{ selected: a.goal === g }}
            onPress={() => patch({ goal: g })}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-full ${
              a.goal === g ? 'bg-white' : ''
            }`}
          >
            <MaterialIcons
              name={g === 'duration' ? 'schedule' : 'straighten'}
              size={20}
              color={a.goal === g ? colors.brand.DEFAULT : colors.ink.secondary}
            />
            <Text
              variant="body-lg"
              className={a.goal === g ? 'font-bold text-brand' : 'text-ink-secondary'}
            >
              {g === 'duration' ? copy.duration : copy.distance}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Halka + ± */}
      <View
        className="items-center gap-space-md rounded-lg bg-white p-space-lg"
        style={shadows.level2}
      >
        <DurationRing fraction={fraction}>
          <View className="items-center gap-1">
            <Text variant="label-caps" className="text-ink-secondary">
              {isDuration ? copy.targetDuration : copy.targetDistance}
            </Text>
            <Text
              variant="display-hero"
              className="text-center"
              style={{ fontSize: 34, lineHeight: 40 }}
            >
              {bigText}
            </Text>
            <View className="flex-row items-center gap-1 rounded-full bg-surface-container px-3 py-1">
              <MaterialIcons name="timeline" size={16} color={colors.accent.DEFAULT} />
              <Text variant="label-sm" className="font-bold">
                {helper}
              </Text>
            </View>
          </View>
        </DurationRing>
        <View className="w-full flex-row items-center justify-between">
          <RoundButton icon="remove" label={copy.decrease} onPress={() => change(-1)} />
          <View className="flex-row items-center gap-1 rounded-full bg-surface-container px-3 py-2">
            <MaterialIcons name="speed" size={16} color={colors.brand.DEFAULT} />
            <Text variant="label-sm" className="font-bold text-brand">
              {copy.adaptsToPace}
            </Text>
          </View>
          <RoundButton icon="add" label={copy.increase} onPress={() => change(1)} />
        </View>
      </View>

      {/* Hızlı seçimler */}
      <View className="gap-space-sm">
        <View className="flex-row items-center justify-between">
          <Text variant="headline-sm">{copy.quickTitle}</Text>
          <Text variant="label-sm" className="text-ink-secondary">
            {copy.quickHint}
          </Text>
        </View>
        <View className="flex-row gap-space-sm">
          {(isDuration ? QUICK_DURATIONS_MIN : QUICK_DISTANCES_KM[a.activityType]).map((q) => {
            const selected = q === value;
            return (
              <Pressable
                key={q}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => patch(isDuration ? { durationMin: q } : { distanceKm: q })}
                className={`min-h-[64px] flex-1 items-center justify-center rounded-lg ${
                  selected ? 'bg-brand' : 'bg-surface-container-low'
                }`}
              >
                <Text variant="headline-sm" className={selected ? 'text-white' : ''}>
                  {isDuration ? formatClock(q).replace(' 00 dk', ' sa') : `${q} km`}
                </Text>
                <Text
                  variant="label-sm"
                  className={selected ? 'text-white/85' : 'text-ink-secondary'}
                >
                  {isDuration
                    ? quickChipKm(a, q)
                    : formatClock(estimateMinutes(a.activityType, q, a.slope, a.paceSecPerKm))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Akıllı hesaplayıcı */}
      <View className="flex-row items-center gap-space-md rounded-lg bg-surface-container p-space-md">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-white">
          <MaterialIcons name="auto-awesome" size={20} color={colors.brand.DEFAULT} />
        </View>
        <View className="flex-1">
          <Text variant="headline-sm">{copy.smartTitle}</Text>
          <Text variant="body-md" className="text-ink-secondary">
            {copy.smartBody}
          </Text>
        </View>
      </View>

      {/* Gerçek rotalardan öneriler */}
      {recommended || nature ? (
        <View className="flex-row gap-space-md">
          {recommended ? (
            <RouteSuggestionCard
              icon="route"
              gradient={[...suggestionGradients.recommended]}
              tag={copy.recommendedTag}
              title={recommended.title}
              meta={routeMeta(recommended)}
              onPress={() =>
                router.push({ pathname: '/route/[id]', params: { id: recommended.id } })
              }
            />
          ) : null}
          {nature ? (
            <RouteSuggestionCard
              icon="park"
              gradient={[...suggestionGradients.nature]}
              tag={copy.natureTag}
              title={nature.title}
              meta={routeMeta(nature)}
              onPress={() => router.push({ pathname: '/route/[id]', params: { id: nature.id } })}
            />
          ) : null}
        </View>
      ) : null}
    </WizardScaffold>
  );
}
