import * as TaskManager from 'expo-task-manager';

import { trackingEngine, type LocationLike } from '@/lib/trackingEngine';
import { LOCATION_TASK } from '@/lib/trackingLocation';

/**
 * Arka plan konum görevi. `TaskManager.defineTask` uygulamanın en üst düzeyinde (modül yüklenirken)
 * çağrılmak zorundadır; bu dosya app/_layout.tsx'ten import edilir. Görev yalnızca motora
 * konumları iletir; kayıt (SQLite), hesap ve sesli bildirim motorda yapılır.
 */
TaskManager.defineTask<{ locations: LocationLike[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  try {
    await trackingEngine.ingestFromTask(data.locations);
  } catch (e) {
    console.warn('[tracking] konum işlenemedi', e);
  }
});
