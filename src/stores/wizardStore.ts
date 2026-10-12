import { create } from 'zustand';

import { DEFAULT_ANSWERS, clampGoalToActivity, type WizardAnswers } from '@/lib/wizard';
import type { ProfileRow } from '@/types/database';

type WizardState = WizardAnswers & {
  /** Alanları günceller (adımlar arası geri-ileri gidince seçimler korunur). */
  patch: (patch: Partial<WizardAnswers>) => void;
  /** Aktivite değişince süre/mesafe sınırlarını da uygular. */
  setActivity: (activity: WizardAnswers['activityType']) => void;
  /** Sihirbazı varsayılanlara döndürür; profil varsa aktivite ve tempoyu oradan alır. */
  reset: (profile?: Pick<ProfileRow, 'activity_prefs' | 'default_pace_sec_per_km'> | null) => void;
};

export const useWizardStore = create<WizardState>((set, get) => ({
  ...DEFAULT_ANSWERS,

  patch: (patch) => set(patch),

  setActivity: (activityType) => {
    const next = { ...get(), activityType };
    set({ activityType, ...clampGoalToActivity(next) });
  },

  reset: (profile) => {
    const preferred = profile?.activity_prefs?.[0];
    set({
      ...DEFAULT_ANSWERS,
      activityType: preferred ?? DEFAULT_ANSWERS.activityType,
      paceSecPerKm: profile?.default_pace_sec_per_km ?? DEFAULT_ANSWERS.paceSecPerKm,
    });
  },
}));

/** Yalnızca cevap alanlarını (fonksiyonlar hariç) döndürür. */
export function selectAnswers(state: WizardState): WizardAnswers {
  const {
    activityType,
    routeType,
    start,
    startLabel,
    startIsCurrent,
    end,
    endLabel,
    goal,
    durationMin,
    distanceKm,
    scenery,
    slope,
    extras,
    paceSecPerKm,
  } = state;
  return {
    activityType,
    routeType,
    start,
    startLabel,
    startIsCurrent,
    end,
    endLabel,
    goal,
    durationMin,
    distanceKm,
    scenery,
    slope,
    extras,
    paceSecPerKm,
  };
}
