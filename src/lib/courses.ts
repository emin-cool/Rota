import { DURATION_LIMITS, type WizardAnswers } from '@/lib/wizard';
import type {
  ActivityType,
  CourseDayRow,
  CourseEnrollmentRow,
  WorkoutPhase,
  WorkoutPhaseType,
} from '@/types/database';

/** Bir fazın toplam süresi (sn): aralıkta her tekrarın ardından dinlenme de sayılır. */
export function phaseTotalSec(phase: WorkoutPhase): number {
  const repeat = phase.repeat ?? 1;
  return repeat * (phase.duration_sec + (phase.rest?.duration_sec ?? 0));
}

export function workoutTotalSec(workout: WorkoutPhase[]): number {
  return workout.reduce((sum, p) => sum + phaseTotalSec(p), 0);
}

/** Dakikaya yuvarlanmış süre dağılımı: ana efor (koşu/bisiklet), yürüyüş, ısınma+soğuma. */
export type EffortSplit = { effortMin: number; walkMin: number; warmCoolMin: number };

const EFFORT_TYPES: WorkoutPhaseType[] = ['run', 'ride'];

export function effortSplit(workout: WorkoutPhase[]): EffortSplit {
  let effort = 0;
  let walk = 0;
  let warmCool = 0;
  const add = (type: WorkoutPhaseType, sec: number) => {
    if (EFFORT_TYPES.includes(type)) effort += sec;
    else if (type === 'walk') walk += sec;
    else warmCool += sec;
  };
  for (const p of workout) {
    const repeat = p.repeat ?? 1;
    add(p.type, p.duration_sec * repeat);
    if (p.rest) add(p.rest.type, p.rest.duration_sec * repeat);
  }
  const min = (sec: number) => Math.round(sec / 60);
  return { effortMin: min(effort), walkMin: min(walk), warmCoolMin: min(warmCool) };
}

/** Hafta, sonra gün sırasına dizer (kaynağı değiştirmez). */
export function sortDays(days: CourseDayRow[]): CourseDayRow[] {
  return [...days].sort((a, b) => a.week_no - b.week_no || a.day_no - b.day_no);
}

export type WeekGroup = { weekNo: number; days: CourseDayRow[] };

export function groupByWeek(days: CourseDayRow[]): WeekGroup[] {
  const groups: WeekGroup[] = [];
  for (const day of sortDays(days)) {
    const last = groups[groups.length - 1];
    if (last && last.weekNo === day.week_no) last.days.push(day);
    else groups.push({ weekNo: day.week_no, days: [day] });
  }
  return groups;
}

/** Tamamlanmamış ilk gün; hepsi bittiyse null. */
export function nextDay(days: CourseDayRow[], completedIds: string[]): CourseDayRow | null {
  const done = new Set(completedIds);
  return sortDays(days).find((d) => !done.has(d.id)) ?? null;
}

/** Katalogda olmayan (silinmiş) gün kimlikleri sayılmaz; 0–100 tam sayı. */
export function progressPercent(days: CourseDayRow[], completedIds: string[]): number {
  if (days.length === 0) return 0;
  const valid = new Set(days.map((d) => d.id));
  const done = new Set(completedIds.filter((id) => valid.has(id))).size;
  return Math.round((done / days.length) * 100);
}

/** Etkin kayıt: tamamlanmamış, en son başlanan. */
export function activeEnrollment(enrollments: CourseEnrollmentRow[]): CourseEnrollmentRow | null {
  const open = enrollments.filter((e) => !e.completed_at);
  open.sort((a, b) => b.started_at.localeCompare(a.started_at));
  return open[0] ?? null;
}

/**
 * "Bu antrenman için rota bul": sihirbaz süre hedefiyle ve düz eğimle açılır.
 * Süre, aktivitenin sihirbaz sınırlarına çekilir.
 */
export function wizardPatchForDay(
  activityType: ActivityType,
  day: Pick<CourseDayRow, 'target_duration_min'>,
): Partial<WizardAnswers> {
  const { min, max } = DURATION_LIMITS[activityType];
  return {
    activityType,
    goal: 'duration',
    durationMin: Math.min(max, Math.max(min, day.target_duration_min)),
    slope: 'flat',
  };
}

/** "5 dk", "1 dk 30 sn", "45 sn". */
export function formatPhaseDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m === 0) return `${s} sn`;
  return s === 0 ? `${m} dk` : `${m} dk ${s} sn`;
}
