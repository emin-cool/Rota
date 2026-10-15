import { tr } from '@/i18n/tr';
import type { WorkoutPhase, WorkoutPhaseType } from '@/types/database';

/** Antrenman fazlarının düz, zaman damgalı listesi (tekrarlar ve aralık dinlenmeleri açılmış). */
export type TimelineStep = {
  type: WorkoutPhaseType;
  /** Antrenman başından itibaren başlangıç (sn). */
  startSec: number;
  durationSec: number;
  /** Aralığın dinlenme adımı mı (koş → dinlen → koş …). */
  isRest: boolean;
  /** 1 tabanlı tekrar numarası; aralık dışı adımlarda null. */
  repeatIndex: number | null;
  repeatCount: number | null;
};

export type StepPosition = {
  index: number;
  step: TimelineStep;
  /** Bu adımın bitmesine kalan süre (sn). */
  remainingSec: number;
  /** Sıradaki adım; son adımdaysa null. */
  next: TimelineStep | null;
};

const PHASE_TYPES: WorkoutPhaseType[] = ['warmup', 'run', 'walk', 'ride', 'cooldown'];

function isPhaseType(v: unknown): v is WorkoutPhaseType {
  return typeof v === 'string' && (PHASE_TYPES as string[]).includes(v);
}

function validPhase(p: unknown): p is WorkoutPhase {
  if (!p || typeof p !== 'object') return false;
  const x = p as Record<string, unknown>;
  if (!isPhaseType(x.type) || typeof x.duration_sec !== 'number' || !(x.duration_sec > 0))
    return false;
  if (x.repeat !== undefined && !(Number.isInteger(x.repeat) && (x.repeat as number) >= 1))
    return false;
  if (x.rest !== undefined) {
    const r = x.rest as Record<string, unknown> | null;
    if (!r || !isPhaseType(r.type) || typeof r.duration_sec !== 'number' || !(r.duration_sec > 0))
      return false;
  }
  return true;
}

/** Yerel oturumda saklanan `workout_json`'u güvenle okur; bozuksa ya da boşsa null. */
export function parseWorkout(json: string | null): WorkoutPhase[] | null {
  if (!json) return null;
  try {
    const data: unknown = JSON.parse(json);
    if (!Array.isArray(data) || data.length === 0 || !data.every(validPhase)) return null;
    return data;
  } catch {
    return null;
  }
}

export function buildTimeline(workout: WorkoutPhase[]): TimelineStep[] {
  const steps: TimelineStep[] = [];
  let at = 0;
  const push = (
    type: WorkoutPhaseType,
    durationSec: number,
    isRest: boolean,
    repeatIndex: number | null,
    repeatCount: number | null,
  ) => {
    steps.push({ type, startSec: at, durationSec, isRest, repeatIndex, repeatCount });
    at += durationSec;
  };
  for (const phase of workout) {
    const repeat = phase.repeat ?? 1;
    const interval = repeat > 1;
    for (let i = 1; i <= repeat; i++) {
      push(phase.type, phase.duration_sec, false, interval ? i : null, interval ? repeat : null);
      if (phase.rest)
        push(
          phase.rest.type,
          phase.rest.duration_sec,
          true,
          interval ? i : null,
          interval ? repeat : null,
        );
    }
  }
  return steps;
}

export function timelineTotalSec(timeline: TimelineStep[]): number {
  const last = timeline[timeline.length - 1];
  return last ? last.startSec + last.durationSec : 0;
}

/** Geçen süreye (duraklatmalar hariç) göre hangi adımda olduğumuz; antrenman bittiyse null. */
export function stepAt(timeline: TimelineStep[], elapsedSec: number): StepPosition | null {
  const t = Math.max(0, elapsedSec);
  for (let i = 0; i < timeline.length; i++) {
    const step = timeline[i]!;
    const end = step.startSec + step.durationSec;
    if (t < end) {
      return { index: i, step, remainingSec: end - t, next: timeline[i + 1] ?? null };
    }
  }
  return null;
}

function spokenDuration(sec: number): string {
  return sec >= 60 ? tr.spoken.minutes(Math.round(sec / 60)) : tr.spoken.seconds(Math.round(sec));
}

/** Adım başlarken söylenecek Türkçe cümle. */
export function buildStepAnnouncement(step: TimelineStep): string {
  const w = tr.spoken.workout;
  switch (step.type) {
    case 'warmup':
      return w.warmup(spokenDuration(step.durationSec));
    case 'run':
      return step.repeatIndex !== null ? w.runRepeat(step.repeatIndex) : w.run;
    case 'walk':
      return step.isRest ? w.restWalk : w.mainWalk;
    case 'ride':
      return w.ride;
    case 'cooldown':
      return w.cooldown;
  }
}

export const buildWorkoutDoneAnnouncement = (): string => tr.spoken.workout.done;

/** Kalan süreyi yukarı yuvarlayıp "m:ss" yazar: 29,2 → "0:30", 125 → "2:05". */
export function formatStepClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
