import { useEffect, useSyncExternalStore } from 'react';

import { trackingEngine, type EngineSnapshot } from '@/lib/trackingEngine';

/**
 * Canlı aktivite durumu. Asıl durum `trackingEngine` içindedir (arka plan görevi de aynı örneği
 * kullanır); bu hook arayüzü ona bağlar. Açılışta kayıttan toparlar (uygulama kapanmış olabilir).
 */
export function useActivity(): EngineSnapshot {
  useEffect(() => {
    void trackingEngine.hydrate();
  }, []);
  return useSyncExternalStore(
    trackingEngine.subscribe,
    trackingEngine.getSnapshot,
    trackingEngine.getSnapshot,
  );
}

export { trackingEngine };
