import { MaterialIcons } from '@expo/vector-icons';
import * as Battery from 'expo-battery';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HoldButton } from '@/components/live/HoldButton';
import { LiveMiniMap } from '@/components/live/LiveMiniMap';
import { Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import { DEFAULT_CENTER } from '@/lib/mapConfig';
import { elapsedSeconds, formatElapsed, formatKmClock, formatPaceClock } from '@/lib/tracking';
import { trackingEngine, useActivity } from '@/stores/activityStore';
import { colors } from '@/theme/tokens';

type IconName = keyof typeof MaterialIcons.glyphMap;

function gpsLabel(accuracy: number | null): { text: string; ok: boolean } {
  const g = tr.live.gps;
  if (accuracy === null) return { text: g.searching, ok: false };
  if (accuracy <= 10) return { text: g.excellent, ok: true };
  if (accuracy <= 25) return { text: g.good, ok: true };
  return { text: g.weak, ok: false };
}

function StatCard({
  icon,
  tag,
  value,
  unit,
  label,
}: {
  icon: IconName;
  tag?: string;
  value: string;
  unit?: string;
  label: string;
}) {
  return (
    <View className="flex-1 gap-space-sm rounded-xl border border-live-border bg-live-card p-space-md">
      <View className="flex-row items-center justify-between">
        <MaterialIcons name={icon} size={22} color={colors['primary-fixed-dim']} />
        {tag ? (
          <View className="rounded-md bg-live-card-green px-2 py-1">
            <Text variant="label-caps" className="text-primary-fixed">
              {tag}
            </Text>
          </View>
        ) : null}
      </View>
      <View className="flex-row items-baseline gap-1">
        <Text variant="metric-numeral" className="text-white">
          {value}
        </Text>
        {unit ? (
          <Text variant="body-md" className="text-primary-fixed-dim">
            {unit}
          </Text>
        ) : null}
      </View>
      <Text variant="label-caps" className="text-primary-fixed-dim">
        {label}
      </Text>
    </View>
  );
}

export default function LiveActivityScreen() {
  useKeepAwake(); // canlı ekran açıkken ekran kapanmasın (kayıt zaten kilit ekranında da sürer)
  const insets = useSafeAreaInsets();
  const snap = useActivity();
  const batteryLevel = Battery.useBatteryLevel();

  const [now, setNow] = useState(() => Date.now());
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Kayıt yoksa (bitti/silindi) ana ekrana dön.
  const { status } = snap;
  // Bitir'e basıldıysa özet ekranına geçiş zaten yapılıyor; "kayıt yok" yönlendirmesi onu ezmesin.
  const finishing = useRef(false);
  useEffect(() => {
    if (status === 'idle') {
      const t = setTimeout(() => {
        if (finishing.current) return;
        if (trackingEngine.getSnapshot().status === 'idle') router.replace('/');
      }, 400); // ilk açılışta kayıttan toparlanmayı bekle
      return () => clearTimeout(t);
    }
  }, [status]);

  const session = snap.session;
  const elapsed = session
    ? elapsedSeconds({
        startedAt: session.started_at,
        now,
        pausedMs: session.paused_ms,
        pauseStartedAt: session.pause_started_at,
      })
    : 0;
  const paused = snap.status === 'paused';
  const gps = gpsLabel(snap.accuracy);
  const hasRoute = snap.route !== null && snap.routeTotalM !== null;
  const current = snap.lastPoint
    ? ([snap.lastPoint.lng, snap.lastPoint.lat] as [number, number])
    : null;

  const finish = async () => {
    finishing.current = true;
    const id = await trackingEngine.finish();
    router.replace(id ? { pathname: '/activity/summary', params: { id } } : '/');
  };

  const toggleSimulation = () => {
    if (!__DEV__) return;
    if (snap.simulating) void trackingEngine.stopSimulation();
    else void trackingEngine.startSimulation(current ?? snap.route?.[0] ?? DEFAULT_CENTER, 4);
  };

  const arrival =
    snap.etaMs !== null
      ? new Date(snap.etaMs).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      : null;

  return (
    <View className="flex-1 bg-live-bg" style={{ paddingTop: insets.top }}>
      <StatusBar style="light" />

      {/* Üst bar */}
      <View className="h-14 flex-row items-center px-space-sm">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.wizard.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          className="h-11 w-11 items-center justify-center rounded-full"
        >
          <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.white} />
        </Pressable>
        <Text variant="headline-sm" className="flex-1 text-white" accessibilityRole="header">
          {tr.live.title}
        </Text>
      </View>

      <ScrollView
        contentContainerClassName="gap-space-md px-margin pb-space-md"
        showsVerticalScrollIndicator={false}
      >
        {/* GPS ve pil */}
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={gps.text}
            onLongPress={toggleSimulation}
            delayLongPress={800}
            className="min-h-[44px] flex-row items-center gap-2 rounded-full bg-live-card px-3"
          >
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: gps.ok ? colors.live.ok : colors.live.alert }}
            />
            <Text
              variant="label-caps"
              style={{ color: gps.ok ? colors.live.ok : colors.live.alert }}
            >
              {gps.text}
            </Text>
          </Pressable>
          {batteryLevel >= 0 ? (
            <View className="min-h-[36px] flex-row items-center gap-1 rounded-full bg-live-card px-3">
              <MaterialIcons name="battery-std" size={18} color={colors.live.ok} />
              <Text variant="label-caps" className="text-white">
                {tr.live.battery(Math.round(batteryLevel * 100))}
              </Text>
            </View>
          ) : null}
        </View>

        {snap.simulating ? (
          <View className="rounded-lg bg-live-card-green px-space-md py-2">
            <Text variant="label-caps" className="text-primary-fixed">
              {tr.live.simulateOn}
            </Text>
          </View>
        ) : null}

        {/* Rotadan çıkma uyarısı */}
        {snap.offRoute ? (
          <View
            className="flex-row items-center gap-space-md rounded-xl bg-live-alert-bg p-space-md"
            accessibilityLiveRegion="assertive"
          >
            <View className="h-12 w-12 items-center justify-center rounded-full bg-accent">
              <MaterialIcons name="call-split" size={26} color={colors.white} />
            </View>
            <View className="flex-1">
              <Text variant="headline-sm" className="text-white">
                {tr.live.offRoute}
              </Text>
              <Text variant="body-md" className="text-live-alert-soft">
                {tr.live.offRouteHint}
              </Text>
            </View>
            {snap.offRouteM !== null ? (
              <View className="rounded-full bg-black/30 px-3 py-1.5">
                <Text variant="label-sm" className="font-bold text-live-alert-soft">
                  {tr.live.offRouteBy(Math.round(snap.offRouteM))}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Geçen süre */}
        <View className="items-center gap-space-sm rounded-xl border border-live-border bg-live-card-deep px-space-md py-space-lg">
          <View className="flex-row items-center gap-1">
            <MaterialIcons name="timer" size={16} color={colors['primary-fixed-dim']} />
            <Text variant="label-caps" className="text-primary-fixed">
              {tr.live.elapsed}
            </Text>
          </View>
          <Text
            variant="display-hero"
            className="text-white"
            accessibilityLabel={`${tr.live.elapsed}: ${formatElapsed(elapsed)}`}
            style={{ fontSize: 56, lineHeight: 64, fontVariant: ['tabular-nums'] }}
          >
            {formatElapsed(elapsed)}
          </Text>
          <View className="flex-row items-center gap-2">
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: paused ? colors.accent.DEFAULT : colors.live.ok }}
            />
            <Text variant="body-md" className="text-primary-fixed-dim">
              {paused ? tr.live.paused : tr.live.recording}
            </Text>
          </View>
        </View>

        {/* Mesafe ve tempo */}
        <View className="flex-row gap-space-md">
          <StatCard
            icon="straighten"
            tag={
              hasRoute
                ? tr.live.target(formatKmClock(snap.routeTotalM!).replace(/,00$/, ''))
                : tr.live.free
            }
            value={formatKmClock(snap.stats.distanceM)}
            label={tr.live.distance}
          />
          <StatCard
            icon="speed"
            tag={tr.live.paceTag}
            value={formatPaceClock(snap.stats.avgPaceSecPerKm)}
            label={tr.live.avgPace}
          />
        </View>
        <View className="flex-row gap-space-md">
          <StatCard
            icon="bolt"
            value={formatPaceClock(snap.stats.currentPaceSecPerKm)}
            label={tr.live.currentPace}
          />
          <StatCard
            icon="terrain"
            value={`+${Math.round(snap.stats.ascentM)}`}
            unit="m"
            label={tr.live.ascent}
          />
        </View>

        {/* Mini harita şeridi */}
        <View className="h-[210px] overflow-hidden rounded-xl border border-live-border bg-live-card-deep">
          <LiveMiniMap route={snap.route} track={snap.track} current={current} />
          <View className="absolute left-3 top-3 flex-row items-center gap-2 rounded-lg bg-black/70 px-3 py-2">
            <MaterialIcons name="navigation" size={16} color={colors.accent.DEFAULT} />
            <Text variant="label-caps" className="text-white" numberOfLines={1}>
              {tr.live.trackName(session?.route_title ?? tr.live.free)}
            </Text>
          </View>
          {hasRoute && snap.remainingM !== null ? (
            <View className="absolute bottom-3 left-3 flex-row items-center gap-3 rounded-lg bg-black/70 px-3 py-2">
              <MaterialIcons name="flag" size={16} color={colors.live.ok} />
              <Text variant="body-md" className="font-bold text-white">
                {tr.live.remaining(formatKmClock(snap.remainingM))}
              </Text>
              {arrival ? (
                <Text variant="label-sm" className="text-primary-fixed-dim">
                  {tr.live.arrival(arrival)}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Kontroller */}
      <View
        className="gap-space-md px-margin pt-space-sm"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr.live.lock}
            onPress={() => setLocked(true)}
            className="h-14 w-14 items-center justify-center rounded-full bg-live-card"
          >
            <MaterialIcons name="lock-open" size={26} color={colors['primary-fixed-dim']} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={paused ? tr.live.resume : tr.live.pause}
            onPress={() => void (paused ? trackingEngine.resume() : trackingEngine.pause())}
            className="h-28 w-28 items-center justify-center rounded-full bg-accent active:bg-accent-pressed"
          >
            <MaterialIcons name={paused ? 'play-arrow' : 'pause'} size={48} color={colors.white} />
            <Text variant="label-caps" className="text-white">
              {paused ? tr.live.resume : tr.live.pause}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={snap.voiceEnabled ? tr.live.voiceOn : tr.live.voiceOff}
            onPress={() => void trackingEngine.setVoiceEnabled(!snap.voiceEnabled)}
            className="h-14 w-14 items-center justify-center rounded-full bg-live-card"
          >
            <MaterialIcons
              name={snap.voiceEnabled ? 'volume-up' : 'volume-off'}
              size={26}
              color={snap.voiceEnabled ? colors.live.ok : colors.ink.muted}
            />
          </Pressable>
        </View>

        <HoldButton
          accessibilityLabel={tr.live.finishHold}
          onConfirm={() => void finish()}
          className="h-14 rounded-full bg-black"
        >
          <View className="flex-row items-center gap-3">
            <View className="h-3.5 w-3.5 border-2" style={{ borderColor: colors.live.alert }} />
            <Text variant="body-lg" className="font-bold text-white">
              {tr.live.finishHold}
            </Text>
          </View>
        </HoldButton>
      </View>

      {/* Ekran kilidi: yanlışlıkla dokunmayı engeller */}
      {locked ? (
        <View
          className="absolute inset-0 items-center justify-end bg-black/70 px-margin"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
          accessibilityLabel={tr.live.locked}
        >
          <MaterialIcons name="lock" size={40} color={colors.white} />
          <Text variant="body-md" className="mb-space-md mt-space-sm text-white">
            {tr.live.locked}
          </Text>
          <HoldButton
            accessibilityLabel={tr.live.unlockHold}
            onConfirm={() => setLocked(false)}
            fillClassName="bg-brand/60"
            className="h-14 w-full rounded-full bg-live-card"
          >
            <Text variant="body-lg" className="font-bold text-white">
              {tr.live.unlockHold}
            </Text>
          </HoldButton>
        </View>
      ) : null}
    </View>
  );
}
