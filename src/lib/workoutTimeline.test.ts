import {
  buildStepAnnouncement,
  buildTimeline,
  formatStepClock,
  parseWorkout,
  stepAt,
  timelineTotalSec,
} from './workoutTimeline';
import type { WorkoutPhase } from '@/types/database';

const intervals: WorkoutPhase[] = [
  { type: 'warmup', duration_sec: 300 },
  { type: 'run', duration_sec: 60, repeat: 3, rest: { type: 'walk', duration_sec: 120 } },
  { type: 'cooldown', duration_sec: 300 },
];

describe('buildTimeline', () => {
  const timeline = buildTimeline(intervals);

  it('tekrarları ve dinlenmeleri düz listeye açar', () => {
    expect(timeline.map((s) => [s.type, s.startSec, s.durationSec])).toEqual([
      ['warmup', 0, 300],
      ['run', 300, 60],
      ['walk', 360, 120],
      ['run', 480, 60],
      ['walk', 540, 120],
      ['run', 660, 60],
      ['walk', 720, 120],
      ['cooldown', 840, 300],
    ]);
    expect(timelineTotalSec(timeline)).toBe(1140);
  });

  it('aralık adımlarına tekrar numarası ve dinlenme işareti koyar', () => {
    expect(timeline[1]).toMatchObject({ isRest: false, repeatIndex: 1, repeatCount: 3 });
    expect(timeline[4]).toMatchObject({ type: 'walk', isRest: true, repeatIndex: 2 });
    expect(timeline[0]).toMatchObject({ repeatIndex: null, repeatCount: null });
  });

  it('tekrarsız faz tek adım olur; dinlenmesiz kesintisiz koşu çalışır', () => {
    const t = buildTimeline([{ type: 'run', duration_sec: 1800 }]);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ repeatIndex: null, isRest: false });
  });
});

describe('stepAt', () => {
  const timeline = buildTimeline(intervals);

  it('geçen süreye göre adımı, kalan süreyi ve sıradakini verir', () => {
    expect(stepAt(timeline, 0)).toMatchObject({ index: 0, remainingSec: 300 });
    expect(stepAt(timeline, 299.5)?.index).toBe(0);
    const p = stepAt(timeline, 330)!;
    expect(p.index).toBe(1);
    expect(p.remainingSec).toBe(30);
    expect(p.next?.type).toBe('walk');
  });

  it('adım sınırında yeni adıma geçer', () => {
    expect(stepAt(timeline, 300)?.index).toBe(1);
    expect(stepAt(timeline, 360)?.index).toBe(2);
  });

  it('son adımda sıradaki yoktur; antrenman bitince null döner', () => {
    expect(stepAt(timeline, 1000)?.next).toBeNull();
    expect(stepAt(timeline, 1140)).toBeNull();
    expect(stepAt(timeline, 9999)).toBeNull();
  });

  it('negatif süreyi sıfır sayar', () => {
    expect(stepAt(timeline, -5)?.index).toBe(0);
  });
});

describe('parseWorkout', () => {
  it('geçerli planı okur', () => {
    expect(parseWorkout(JSON.stringify(intervals))).toEqual(intervals);
  });

  it('boş, bozuk ya da geçersiz planı reddeder', () => {
    expect(parseWorkout(null)).toBeNull();
    expect(parseWorkout('{bozuk')).toBeNull();
    expect(parseWorkout('[]')).toBeNull();
    expect(parseWorkout(JSON.stringify([{ type: 'sprint', duration_sec: 60 }]))).toBeNull();
    expect(parseWorkout(JSON.stringify([{ type: 'run', duration_sec: 0 }]))).toBeNull();
    expect(parseWorkout(JSON.stringify([{ type: 'run', duration_sec: 60, repeat: 0 }]))).toBeNull();
    expect(
      parseWorkout(
        JSON.stringify([{ type: 'run', duration_sec: 60, repeat: 2, rest: { type: 'x' } }]),
      ),
    ).toBeNull();
  });
});

describe('buildStepAnnouncement', () => {
  const t = buildTimeline(intervals);

  it('her adım türü için Türkçe yönlendirme söyler', () => {
    expect(buildStepAnnouncement(t[0]!)).toBe('Isınma başlıyor. 5 dakika.');
    expect(buildStepAnnouncement(t[1]!)).toBe('1. tekrar. Şimdi koş!');
    expect(buildStepAnnouncement(t[2]!)).toBe('Yürüyüşe geç.');
    expect(buildStepAnnouncement(t[7]!)).toContain('Soğuma');
  });

  it('tekrarsız koşu ve ana yürüyüş/sürüş farklı söylenir', () => {
    const [run, walk, ride] = buildTimeline([
      { type: 'run', duration_sec: 600 },
      { type: 'walk', duration_sec: 600 },
      { type: 'ride', duration_sec: 600 },
    ]);
    expect(buildStepAnnouncement(run!)).toBe('Şimdi koş!');
    expect(buildStepAnnouncement(walk!)).toBe('Tempolu yürüyüş başlıyor.');
    expect(buildStepAnnouncement(ride!)).toBe('Sürüş başlıyor.');
  });

  it('kısa adımda süreyi saniye olarak söyler', () => {
    const [w] = buildTimeline([{ type: 'warmup', duration_sec: 45 }]);
    expect(buildStepAnnouncement(w!)).toBe('Isınma başlıyor. 45 saniye.');
  });
});

describe('formatStepClock', () => {
  it('kalan süreyi yukarı yuvarlayıp m:ss yazar', () => {
    expect(formatStepClock(29.2)).toBe('0:30');
    expect(formatStepClock(125)).toBe('2:05');
    expect(formatStepClock(0)).toBe('0:00');
    expect(formatStepClock(-3)).toBe('0:00');
  });
});
