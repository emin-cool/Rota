import { MaterialIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import {
  buildTimeline,
  formatStepClock,
  parseWorkout,
  stepAt,
  type TimelineStep,
} from '@/lib/workoutTimeline';
import { colors } from '@/theme/tokens';
import type { WorkoutPhaseType } from '@/types/database';

const ICON: Record<WorkoutPhaseType, keyof typeof MaterialIcons.glyphMap> = {
  warmup: 'self-improvement',
  run: 'directions-run',
  walk: 'directions-walk',
  ride: 'directions-bike',
  cooldown: 'spa',
};

function stepLabel(step: TimelineStep): string {
  const base = tr.courseDay.phase[step.type];
  return step.repeatIndex !== null && step.repeatCount !== null
    ? `${base} ${tr.workout.repeat(step.repeatIndex, step.repeatCount)}`
    : base;
}

/**
 * Canlı takipte kurs antrenmanının geçerli fazı: ad, kalan süre, sıradaki faz. Sesli yönlendirmeyi
 * motor yapar; burası yalnızca gösterir. `elapsedSec` duraklatmalar hariç geçen süredir.
 */
export function WorkoutStrip({
  workoutJson,
  elapsedSec,
}: {
  workoutJson: string | null;
  elapsedSec: number;
}) {
  const timeline = useMemo(() => {
    const workout = parseWorkout(workoutJson);
    return workout ? buildTimeline(workout) : null;
  }, [workoutJson]);
  if (!timeline) return null;

  const pos = stepAt(timeline, elapsedSec);
  if (!pos) {
    return (
      <View
        className="gap-1 rounded-lg bg-live-card-green px-3 py-2"
        accessibilityLiveRegion="polite"
      >
        <View className="flex-row items-center gap-2">
          <MaterialIcons name="check-circle" size={20} color={colors.live.ok} />
          <Text variant="body-md" className="font-bold text-white">
            {tr.workout.done}
          </Text>
        </View>
        <Text variant="label-sm" className="text-primary-fixed-dim">
          {tr.workout.doneHint}
        </Text>
      </View>
    );
  }

  const { step, remainingSec, next } = pos;
  const progress = Math.min(1, Math.max(0, 1 - remainingSec / step.durationSec));
  const tint = step.type === 'run' || step.type === 'ride' ? colors.accent.DEFAULT : colors.live.ok;
  return (
    <View
      className="gap-2 rounded-lg bg-black/70 px-3 py-2"
      accessible
      accessibilityLabel={`${stepLabel(step)}. ${tr.workout.remaining(formatStepClock(remainingSec))}`}
    >
      <View className="flex-row items-center gap-2">
        <MaterialIcons name={ICON[step.type]} size={22} color={tint} />
        <Text variant="body-md" className="flex-1 font-bold text-white" numberOfLines={1}>
          {stepLabel(step)}
        </Text>
        <Text
          variant="headline-sm"
          className="text-white"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {formatStepClock(remainingSec)}
        </Text>
      </View>
      <View className="h-1.5 overflow-hidden rounded-full bg-white/20">
        <View
          className="h-1.5 rounded-full"
          style={{ width: `${Math.round(progress * 100)}%`, backgroundColor: tint }}
        />
      </View>
      {next ? (
        <Text variant="label-sm" className="text-primary-fixed-dim">
          {tr.workout.next(stepLabel(next))}
        </Text>
      ) : null}
    </View>
  );
}
