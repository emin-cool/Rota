import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, HeadlineLg, Text } from '@/components/ui';
import { tr } from '@/i18n/tr';
import {
  formatPaceClock,
  formatKmClock,
  computeStats,
  smoothPoints,
  formatElapsed,
} from '@/lib/tracking';
import { getSession, loadPoints } from '@/lib/trackingDb';

/**
 * Geçici iskelet: bitirilen kaydın temel sayıları yerel kayıttan gösterilir.
 * Gerçek özet ekranı (harita, fotoğraf, puanlama) ve Supabase'e yükleme P1.5'te yapılacak.
 */
export default function ActivitySummaryStub() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    void (async () => {
      const session = await getSession(id);
      if (!session || !active) return;
      const points = smoothPoints(await loadPoints(id));
      const stats = computeStats(points, session.activity_type);
      const durationSec =
        ((session.ended_at ?? session.started_at) - session.started_at - session.paused_ms) / 1000;
      if (active) {
        setText(
          `${formatKmClock(stats.distanceM)} km • ${formatElapsed(durationSec)} • ${formatPaceClock(stats.avgPaceSecPerKm)} /km`,
        );
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <View
      className="flex-1 justify-center gap-space-md bg-canvas px-margin"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <HeadlineLg>{tr.summaryStub.title}</HeadlineLg>
      <Text variant="body-lg">{tr.summaryStub.saved}</Text>
      {text ? (
        <Text variant="headline-md" className="text-brand">
          {text}
        </Text>
      ) : null}
      <Text className="text-ink-secondary">{tr.summaryStub.comingSoon}</Text>
      <Button title={tr.summaryStub.home} onPress={() => router.replace('/')} />
    </View>
  );
}
