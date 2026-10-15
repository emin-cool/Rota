import { create } from 'zustand';

import {
  DEFAULT_REMINDER,
  parseReminderSettings,
  serializeReminderSettings,
  type ReminderSettings,
} from '@/lib/courseReminder';
import { getSetting, setSetting } from '@/lib/trackingDb';

const SETTING_KEY = 'course_reminder';

type ReminderState = {
  settings: ReminderSettings;
  /** Yerel depodan okundu mu (okunmadan zamanlama yapılmaz, varsayılanla ezilmesin). */
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<ReminderSettings>) => Promise<void>;
};

/** Kurs hatırlatıcısı ayarları: bu cihazda (SQLite `settings`) tutulur, hesaba bağlı değildir. */
export const useCourseReminderStore = create<ReminderState>((set, get) => ({
  settings: { ...DEFAULT_REMINDER },
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    const json = await getSetting(SETTING_KEY);
    set({ settings: parseReminderSettings(json), loaded: true });
  },

  update: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next, loaded: true });
    await setSetting(SETTING_KEY, serializeReminderSettings(next));
  },
}));
