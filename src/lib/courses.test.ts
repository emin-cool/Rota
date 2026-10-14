import {
  activeEnrollment,
  effortSplit,
  formatPhaseDuration,
  groupByWeek,
  nextDay,
  phaseTotalSec,
  progressPercent,
  workoutTotalSec,
  wizardPatchForDay,
} from './courses';
import type { CourseDayRow, CourseEnrollmentRow, WorkoutPhase } from '@/types/database';

const intervals: WorkoutPhase[] = [
  { type: 'warmup', duration_sec: 300 },
  { type: 'run', duration_sec: 60, repeat: 6, rest: { type: 'walk', duration_sec: 120 } },
  { type: 'cooldown', duration_sec: 300 },
];

function day(id: string, week: number, dayNo: number): CourseDayRow {
  return {
    id,
    course_id: 'c1',
    week_no: week,
    day_no: dayNo,
    title: id,
    workout_json: intervals,
    target_duration_min: 28,
    coach_tip: null,
    created_at: '2026-10-16T00:00:00Z',
  };
}

describe('süre hesapları', () => {
  it('aralıkta her tekrarın ardından dinlenme de sayılır', () => {
    expect(phaseTotalSec(intervals[1]!)).toBe(6 * 180);
    expect(workoutTotalSec(intervals)).toBe(28 * 60);
  });

  it('süreyi efor / yürüyüş / ısınma-soğuma olarak böler', () => {
    expect(effortSplit(intervals)).toEqual({ effortMin: 6, walkMin: 12, warmCoolMin: 10 });
  });

  it('dinlenmesiz kesintisiz koşuyu ana efora yazar', () => {
    expect(effortSplit([{ type: 'run', duration_sec: 1800 }])).toEqual({
      effortMin: 30,
      walkMin: 0,
      warmCoolMin: 0,
    });
  });
});

describe('gün sırası ve ilerleme', () => {
  const days = [day('d4', 2, 1), day('d2', 1, 2), day('d1', 1, 1), day('d3', 1, 3)];

  it('haftaya göre gruplar ve sıralar', () => {
    const groups = groupByWeek(days);
    expect(groups.map((g) => [g.weekNo, g.days.map((d) => d.id)])).toEqual([
      [1, ['d1', 'd2', 'd3']],
      [2, ['d4']],
    ]);
  });

  it('sıradaki gün tamamlanmamış ilk gündür', () => {
    expect(nextDay(days, [])?.id).toBe('d1');
    expect(nextDay(days, ['d1', 'd2'])?.id).toBe('d3');
    expect(nextDay(days, ['d1', 'd2', 'd3', 'd4'])).toBeNull();
  });

  it('ilerleme yüzdesi yuvarlanır, bilinmeyen kimlikleri saymaz', () => {
    expect(progressPercent(days, [])).toBe(0);
    expect(progressPercent(days, ['d1'])).toBe(25);
    expect(progressPercent(days, ['d1', 'yok', 'd1'])).toBe(25);
    expect(progressPercent(days, ['d1', 'd2', 'd3', 'd4'])).toBe(100);
    expect(progressPercent([], ['d1'])).toBe(0);
  });
});

describe('activeEnrollment', () => {
  const base = {
    id: 'e',
    user_id: 'u',
    completed_days: [],
    created_at: '',
  };
  it('tamamlanmamış en son kaydı verir', () => {
    const list: CourseEnrollmentRow[] = [
      { ...base, id: 'a', course_id: 'c1', started_at: '2026-10-01', completed_at: null },
      { ...base, id: 'b', course_id: 'c2', started_at: '2026-10-05', completed_at: null },
      { ...base, id: 'c', course_id: 'c3', started_at: '2026-10-09', completed_at: '2026-10-10' },
    ];
    expect(activeEnrollment(list)?.id).toBe('b');
    expect(activeEnrollment([])).toBeNull();
  });
});

describe('wizardPatchForDay', () => {
  it('süre hedefi ve düz eğimle sihirbazı açar', () => {
    expect(wizardPatchForDay('run', { target_duration_min: 28 })).toEqual({
      activityType: 'run',
      goal: 'duration',
      durationMin: 28,
      slope: 'flat',
    });
  });

  it('süreyi aktivitenin sınırlarına çeker', () => {
    expect(wizardPatchForDay('walk', { target_duration_min: 5 }).durationMin).toBe(10);
    expect(wizardPatchForDay('bike', { target_duration_min: 999 }).durationMin).toBe(360);
  });
});

describe('formatPhaseDuration', () => {
  it('dakika ve saniyeyi Türkçe birimlerle yazar', () => {
    expect(formatPhaseDuration(300)).toBe('5 dk');
    expect(formatPhaseDuration(90)).toBe('1 dk 30 sn');
    expect(formatPhaseDuration(45)).toBe('45 sn');
  });
});
