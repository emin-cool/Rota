import * as Crypto from 'expo-crypto';
import * as Speech from 'expo-speech';

import type { LngLat } from '@/lib/geo';
import { lineLengthM, haversineM } from '@/lib/geo';
import {
  advanceAlongRoute,
  buildKmAnnouncement,
  computeStats,
  cumulativeLengths,
  elapsedSeconds,
  estimateArrival,
  isAcceptable,
  kmMarksCrossed,
  routeHeadingAt,
  smoothPoints,
  toTrackPoint,
  updateOffRoute,
  type OffRouteState,
  type Stats,
  type TrackPoint,
} from '@/lib/tracking';
import {
  SETTING_VOICE,
  createSession,
  deleteSession,
  getOpenSession,
  getSetting,
  insertPoints,
  loadPoints,
  setSetting,
  updateSession,
  type SessionRow,
} from '@/lib/trackingDb';
import { startUpdates, stopUpdates } from '@/lib/trackingLocation';
import {
  buildStepAnnouncement,
  buildTimeline,
  buildWorkoutDoneAnnouncement,
  parseWorkout,
  stepAt,
  type TimelineStep,
} from '@/lib/workoutTimeline';
import type { WorkoutPhase } from '@/types/database';
import type { ActivityType } from '@/types/routes';
import { tr } from '@/i18n/tr';

/** Zaten devam eden, noktası olan bir kayıt varken yenisi başlatılmak istendi. */
export class ActiveSessionError extends Error {
  constructor() {
    super('Zaten devam eden bir kayıt var.');
    this.name = 'ActiveSessionError';
  }
}

/** Konum olayının (expo-location LocationObject) ihtiyaç duyulan kısmı. */
export type LocationLike = {
  coords: { latitude: number; longitude: number; altitude: number | null; accuracy: number | null };
  timestamp: number;
};

export type EngineStatus = 'idle' | 'recording' | 'paused';

export type EngineSnapshot = {
  status: EngineStatus;
  session: SessionRow | null;
  stats: Stats;
  /** Son kabul edilen nokta. */
  lastPoint: TrackPoint | null;
  /** Son ham konumun doğruluğu (m): GPS kalite göstergesi için, reddedilenler dahil. */
  accuracy: number | null;
  /** Haritada çizilecek yürünen iz (seyreltilmiş). */
  track: LngLat[];
  route: LngLat[] | null;
  routeTotalM: number | null;
  remainingM: number | null;
  etaMs: number | null;
  offRoute: boolean;
  offRouteM: number | null;
  /** Kullanıcının rota üzerindeki yerinde rotanın gidiş yönü (derece, 0 = kuzey); rota yoksa null. */
  routeHeading: number | null;
  voiceEnabled: boolean;
  simulating: boolean;
};

const ZERO_STATS: Stats = {
  distanceM: 0,
  movingSec: 0,
  avgPaceSecPerKm: null,
  currentPaceSecPerKm: null,
  ascentM: 0,
};

const IDLE: EngineSnapshot = {
  status: 'idle',
  session: null,
  stats: ZERO_STATS,
  lastPoint: null,
  accuracy: null,
  track: [],
  route: null,
  routeTotalM: null,
  remainingM: null,
  etaMs: null,
  offRoute: false,
  offRouteM: null,
  routeHeading: null,
  voiceEnabled: true,
  simulating: false,
};

/** Haritadaki iz bu kadar noktayı aşınca her ikinci nokta atılır (bellek ve çizim maliyeti). */
const MAX_TRACK_POINTS = 800;

/**
 * Canlı takip motoru (React'ten bağımsız tek örnek). Arka plan görevi de arayüz de aynı örneği kullanır:
 * noktalar önce SQLite'a yazılır, istatistikler bellekteki noktalardan hesaplanır, değişiklik olunca
 * dinleyicilere (arayüz) haber verilir. Uygulama kapanıp açılırsa `hydrate()` kayıttan toparlar.
 */
class TrackingEngine {
  private session: SessionRow | null = null;
  private points: TrackPoint[] = [];
  private smoothed: TrackPoint[] = [];
  private track: LngLat[] = [];
  private route: LngLat[] | null = null;
  private cumulative: number[] = [];
  private segmentIndex = 0;
  private offRouteState: OffRouteState = { consecutive: 0, off: false };
  private offRouteM: number | null = null;
  private routeHeading: number | null = null;
  private remainingM: number | null = null;
  private accuracy: number | null = null;
  private lastDistance = 0;
  private lastMarkDistance = 0;
  private lastMarkMoving = 0;
  private voice = true;
  private simulating = false;
  private simTimer: ReturnType<typeof setInterval> | null = null;
  private simLateralM = 0;
  /** Kurs antrenmanı: açılmış adım listesi (yoksa null → sesli aralık yönlendirme kapalı). */
  private timeline: TimelineStep[] | null = null;
  /** Son anons edilen adım; adım değişince yenisi söylenir. */
  private workoutStep = -1;
  private workoutDone = false;
  private workoutTimer: ReturnType<typeof setInterval> | null = null;
  private hydrating: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  private snapshot: EngineSnapshot = IDLE;

  // ------------------------------------------------------------------ dinleme

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): EngineSnapshot => this.snapshot;

  private rebuild() {
    const session = this.session;
    const stats = session ? computeStats(this.smoothed, session.activity_type) : ZERO_STATS;
    const last = this.points[this.points.length - 1] ?? null;
    const routeTotal =
      this.cumulative.length > 0 ? this.cumulative[this.cumulative.length - 1]! : null;
    this.snapshot = {
      status: session ? (session.status === 'paused' ? 'paused' : 'recording') : 'idle',
      session,
      stats,
      lastPoint: last,
      accuracy: this.accuracy,
      track: this.track,
      route: this.route,
      routeTotalM: routeTotal,
      remainingM: this.remainingM,
      etaMs:
        this.remainingM !== null
          ? estimateArrival({
              now: Date.now(),
              remainingM: this.remainingM,
              paceSecPerKm: stats.avgPaceSecPerKm,
            })
          : null,
      offRoute: this.offRouteState.off,
      offRouteM: this.offRouteM,
      routeHeading: this.routeHeading,
      voiceEnabled: this.voice,
      simulating: this.simulating,
    };
    for (const l of this.listeners) l();
  }

  // ------------------------------------------------------------------ yaşam döngüsü

  /** Kayıttan toparlar (uygulama açılışı / arka plan görevi). Birden çok çağrı tek iş yapar. */
  hydrate(): Promise<void> {
    this.hydrating ??= this.doHydrate();
    return this.hydrating;
  }

  private async doHydrate() {
    this.voice = (await getSetting(SETTING_VOICE)) !== '0';
    const open = await getOpenSession();
    if (open) {
      this.session = open;
      this.points = await loadPoints(open.id);
      this.loadRoute(open.route_json);
      this.loadWorkout(open.workout_json, true);
      this.recomputeDerived(false);
      this.lastMarkDistance = Math.floor(this.lastDistance / 1000) * 1000;
      this.lastMarkMoving = this.snapshotStatsMoving();
    }
    this.rebuild();
  }

  private snapshotStatsMoving(): number {
    return computeStats(this.smoothed, this.session?.activity_type ?? 'walk').movingSec;
  }

  private loadRoute(json: string | null) {
    this.route = json ? (JSON.parse(json) as LngLat[]) : null;
    this.cumulative = this.route ? cumulativeLengths(this.route) : [];
    this.segmentIndex = 0;
    this.remainingM = this.route ? lineLengthM(this.route) : null;
    // İlk konum gelene kadar harita rotanın başlangıç yönüne baksın.
    this.routeHeading = this.route ? routeHeadingAt(this.route, this.cumulative, 0) : null;
  }

  /** Bellekteki noktalardan yumuşatılmış seriyi, izi ve rota ilerlemesini yeniden kurar. */
  private recomputeDerived(announce: boolean) {
    this.smoothed = smoothPoints(this.points);
    this.track = this.points.map((p): LngLat => [p.lng, p.lat]);
    while (this.track.length > MAX_TRACK_POINTS)
      this.track = this.track.filter((_, i) => i % 2 === 0);
    const stats = computeStats(this.smoothed, this.session?.activity_type ?? 'walk');
    this.lastDistance = stats.distanceM;
    const last = this.points[this.points.length - 1];
    if (last && this.route) {
      const progress = advanceAlongRoute(
        this.route,
        this.cumulative,
        [last.lng, last.lat],
        this.segmentIndex,
      );
      this.segmentIndex = progress.segmentIndex;
      this.remainingM = Math.max(
        0,
        this.cumulative[this.cumulative.length - 1]! - progress.progressM,
      );
      this.offRouteM = progress.distanceToRouteM;
      this.routeHeading = routeHeadingAt(this.route, this.cumulative, progress.progressM);
      if (announce)
        this.offRouteState = updateOffRoute(this.offRouteState, progress.distanceToRouteM);
    }
  }

  async start(params: {
    activityType: ActivityType;
    route?: LngLat[] | null;
    routeTitle?: string | null;
    /** Planlı rotanın `routes.id`'si. */
    routeId?: string | null;
    /** Kurs antrenmanından başlatıldıysa `course_days.id`. */
    courseDayId?: string | null;
    /** Antrenman planı; verilirse sesli aralık yönlendirme açılır. */
    workout?: WorkoutPhase[] | null;
    /** Geliştirme: gerçek GPS yerine sahte konum akıtılacak mı? */
    simulate?: boolean;
  }): Promise<void> {
    await this.hydrate();
    if (this.session) {
      // Hiç noktası olmayan kayıt (yarım kalmış başlatma) kaybedecek veri taşımaz: sessizce temizle.
      if (this.points.length === 0) await this.discard();
      else throw new ActiveSessionError();
    }

    const now = Date.now();
    const row: SessionRow = {
      id: Crypto.randomUUID(),
      status: 'recording',
      activity_type: params.activityType,
      started_at: now,
      ended_at: null,
      paused_ms: 0,
      pause_started_at: null,
      segment: 0,
      route_json: params.route && params.route.length > 1 ? JSON.stringify(params.route) : null,
      route_title: params.routeTitle ?? null,
      uploaded: 0,
      route_id: params.routeId ?? null,
      course_day_id: params.courseDayId ?? null,
      workout_json: params.workout?.length ? JSON.stringify(params.workout) : null,
      title: null,
      visibility: null,
      queued: 0,
      review_json: null,
      photos_json: null,
      description: null,
      share_route: 0,
    };
    try {
      await createSession(row);
    } catch (e) {
      throw new Error(`kayıt veritabanı (SQLite): ${e instanceof Error ? e.message : String(e)}`);
    }
    this.session = row;
    this.points = [];
    this.smoothed = [];
    this.track = [];
    this.offRouteState = { consecutive: 0, off: false };
    this.offRouteM = null;
    this.accuracy = null;
    this.lastDistance = 0;
    this.lastMarkDistance = 0;
    this.lastMarkMoving = 0;
    this.loadRoute(row.route_json);

    try {
      if (!params.simulate) await startUpdates();
    } catch (e) {
      await deleteSession(row.id);
      this.session = null;
      this.rebuild();
      throw new Error(`konum servisi: ${e instanceof Error ? e.message : String(e)}`);
    }
    this.loadWorkout(row.workout_json, false);
    this.rebuild();
  }

  async pause(): Promise<void> {
    const s = this.session;
    if (!s || s.status !== 'recording') return;
    const now = Date.now();
    this.session = { ...s, status: 'paused', pause_started_at: now };
    await updateSession(s.id, { status: 'paused', pause_started_at: now });
    if (!this.simulating) await stopUpdates();
    this.rebuild();
  }

  async resume(): Promise<void> {
    const s = this.session;
    if (!s || s.status !== 'paused') return;
    const now = Date.now();
    const pausedMs = s.paused_ms + (s.pause_started_at ? now - s.pause_started_at : 0);
    const next: SessionRow = {
      ...s,
      status: 'recording',
      paused_ms: pausedMs,
      pause_started_at: null,
      segment: s.segment + 1, // duraklatma boşluğu mesafeye katılmasın
    };
    this.session = next;
    await updateSession(s.id, {
      status: 'recording',
      paused_ms: pausedMs,
      pause_started_at: null,
      segment: next.segment,
    });
    if (!this.simulating) await startUpdates();
    this.rebuild();
  }

  /** Kaydı bitirir; SQLite'ta 'finished' olarak kalır. Bitirilen kaydın id'sini döndürür. */
  async finish(): Promise<string | null> {
    const s = this.session;
    if (!s) return null;
    this.stopSimulationTimer();
    const now = Date.now();
    const endedAt = s.status === 'paused' && s.pause_started_at ? s.pause_started_at : now;
    const pausedMs =
      s.paused_ms + (s.status === 'paused' && s.pause_started_at ? now - s.pause_started_at : 0);
    await stopUpdates();
    await updateSession(s.id, {
      status: 'finished',
      ended_at: endedAt,
      paused_ms: pausedMs,
      pause_started_at: null,
    });
    this.clearState();
    return s.id;
  }

  /** Kaydı ve noktalarını siler. */
  async discard(): Promise<void> {
    const s = this.session;
    this.stopSimulationTimer();
    await stopUpdates();
    if (s) await deleteSession(s.id);
    this.clearState();
  }

  private clearState() {
    this.stopWorkout();
    this.session = null;
    this.points = [];
    this.smoothed = [];
    this.track = [];
    this.route = null;
    this.cumulative = [];
    this.remainingM = null;
    this.offRouteState = { consecutive: 0, off: false };
    this.offRouteM = null;
    this.routeHeading = null;
    this.accuracy = null;
    this.simulating = false;
    this.rebuild();
  }

  // ------------------------------------------------------------------ konum akışı

  /** Arka plan görevinden gelen gerçek konumlar. Simülasyondayken yok sayılır. */
  async ingestFromTask(locations: LocationLike[]): Promise<void> {
    await this.hydrate();
    if (this.simulating) return;
    await this.ingest(locations);
  }

  async ingest(locations: LocationLike[]): Promise<void> {
    const s = this.session;
    if (!s || s.status !== 'recording' || locations.length === 0) return;
    this.checkWorkout(); // zamanlayıcı arka planda gecikirse konum güncellemesi tetiklesin

    const latestRaw = locations[locations.length - 1]!;
    this.accuracy = latestRaw.coords.accuracy;

    let lastTs = this.points[this.points.length - 1]?.ts ?? 0;
    const fresh: TrackPoint[] = [];
    for (const loc of locations) {
      const p = toTrackPoint(loc, s.segment);
      if (!isAcceptable(p) || p.ts <= lastTs) continue; // kötü doğruluk ya da yinelenen/eski nokta
      fresh.push(p);
      lastTs = p.ts;
    }
    if (fresh.length === 0) {
      this.rebuild(); // yalnızca GPS kalite göstergesi güncellensin
      return;
    }

    await insertPoints(s.id, fresh);
    this.points.push(...fresh);

    const prevDistance = this.lastDistance;
    const wasOff = this.offRouteState.off;
    this.recomputeDerived(true);
    const stats = computeStats(this.smoothed, s.activity_type);

    if (this.voice) {
      const marks = kmMarksCrossed(prevDistance, stats.distanceM);
      const km = marks[marks.length - 1];
      if (km !== undefined) {
        const dDist = stats.distanceM - this.lastMarkDistance;
        const dMoving = stats.movingSec - this.lastMarkMoving;
        const pace = dDist >= 200 ? dMoving / (dDist / 1000) : stats.avgPaceSecPerKm;
        this.speak(buildKmAnnouncement({ km, paceSecPerKm: pace, remainingM: this.remainingM }));
      }
      if (!wasOff && this.offRouteState.off) this.speak(tr.spoken.offRoute);
    }
    if (kmMarksCrossed(prevDistance, stats.distanceM).length > 0) {
      this.lastMarkDistance = Math.floor(stats.distanceM / 1000) * 1000;
      this.lastMarkMoving = stats.movingSec;
    }
    this.rebuild();
  }

  // ------------------------------------------------------------------ antrenman (sesli aralık)

  /**
   * Kurs antrenmanı planını kurar ve saniyelik zamanlayıcıyı başlatır. `silent`: uygulama
   * yeniden açıldığında (hydrate) o anki adım tekrar anons edilmesin.
   */
  private loadWorkout(json: string | null, silent: boolean) {
    this.stopWorkout();
    const workout: WorkoutPhase[] | null = parseWorkout(json);
    if (!workout) return;
    this.timeline = buildTimeline(workout);
    if (silent) {
      const pos = stepAt(this.timeline, this.workoutElapsedSec());
      this.workoutStep = pos?.index ?? -1;
      this.workoutDone = pos === null;
    }
    this.workoutTimer = setInterval(() => this.checkWorkout(), 1000);
    if (!silent) this.checkWorkout();
  }

  private stopWorkout() {
    if (this.workoutTimer) clearInterval(this.workoutTimer);
    this.workoutTimer = null;
    this.timeline = null;
    this.workoutStep = -1;
    this.workoutDone = false;
  }

  private workoutElapsedSec(): number {
    const s = this.session;
    if (!s) return 0;
    return elapsedSeconds({
      startedAt: s.started_at,
      now: Date.now(),
      pausedMs: s.paused_ms,
      pauseStartedAt: s.pause_started_at,
    });
  }

  /** Adım değiştiyse yönlendirmeyi söyler. Duraklatılmışken süre ilerlemediği için sessizdir. */
  private checkWorkout() {
    const timeline = this.timeline;
    if (!timeline || this.workoutDone || this.session?.status !== 'recording') return;
    const pos = stepAt(timeline, this.workoutElapsedSec());
    if (!pos) {
      this.workoutDone = true;
      if (this.voice) this.speak(buildWorkoutDoneAnnouncement());
      if (this.workoutTimer) clearInterval(this.workoutTimer);
      this.workoutTimer = null;
      return;
    }
    if (pos.index === this.workoutStep) return;
    this.workoutStep = pos.index;
    if (this.voice) this.speak(buildStepAnnouncement(pos.step));
  }

  private speak(text: string) {
    try {
      void Speech.stop();
      Speech.speak(text, { language: 'tr-TR', rate: 0.95 });
    } catch {
      // Ses motoru yoksa kayıt etkilenmesin.
    }
  }

  // ------------------------------------------------------------------ ayarlar

  async setVoiceEnabled(enabled: boolean): Promise<void> {
    this.voice = enabled;
    await setSetting(SETTING_VOICE, enabled ? '1' : '0');
    if (!enabled) void Speech.stop();
    this.rebuild();
  }

  // ------------------------------------------------------------------ geliştirme simülasyonu

  private stopSimulationTimer() {
    if (this.simTimer) clearInterval(this.simTimer);
    this.simTimer = null;
  }

  /**
   * Geliştirme: gerçek GPS yerine, planlı rota (yoksa `from`dan kuzeye düz çizgi) boyunca sahte konum
   * akıtır; arayüzü, tempoyu, km bildirimini ve sapma uyarısını dışarı çıkmadan denemek için.
   * `lateralM` > 0 ise rotadan o kadar yana sapmış gibi davranır.
   */
  async startSimulation(from: LngLat, speedMs = 4, lateralM = 0): Promise<void> {
    const s = this.session;
    if (!s || this.simulating) return;
    this.simulating = true;
    this.simLateralM = lateralM;
    await stopUpdates();
    const path: LngLat[] =
      this.route && this.route.length > 1 ? this.route : [from, [from[0], from[1] + 0.05]]; // ~5,5 km kuzeye
    const cum = cumulativeLengths(path);
    const total = cum[cum.length - 1]!;
    let along = 0;
    this.rebuild();

    this.simTimer = setInterval(() => {
      along = Math.min(total, along + speedMs);
      let i = 1;
      while (i < cum.length - 1 && cum[i]! < along) i++;
      const segLen = cum[i]! - cum[i - 1]! || 1;
      const t = (along - cum[i - 1]!) / segLen;
      const a = path[i - 1]!;
      const b = path[i]!;
      const lat = a[1] + (b[1] - a[1]) * t;
      const lng = a[0] + (b[0] - a[0]) * t + (this.simLateralM / 111_195) * 1.3;
      void this.ingest([
        {
          coords: {
            latitude: lat,
            longitude: lng,
            altitude: 20 + 5 * Math.sin(along / 200),
            accuracy: 6,
          },
          timestamp: Date.now(),
        },
      ]);
      if (along >= total) this.stopSimulationTimer();
    }, 1000);
  }

  /** Geliştirme: simülasyonda rotadan yana sapma (m); sapma uyarısını denemek için. */
  setSimulationLateral(meters: number): void {
    this.simLateralM = meters;
  }

  async stopSimulation(): Promise<void> {
    if (!this.simulating) return;
    this.stopSimulationTimer();
    this.simulating = false;
    if (this.session?.status === 'recording') await startUpdates();
    this.rebuild();
  }
}

export const trackingEngine = new TrackingEngine();

/** İki nokta arası yardımcı (simülasyon/test). */
export const distanceBetween = haversineM;
