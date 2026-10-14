import { create } from 'zustand';

import type { ModerationTarget } from '@/lib/moderation';

type ModerationState = {
  /** Açık menünün hedefi; null → menü kapalı. */
  target: ModerationTarget | null;
  open: (target: ModerationTarget) => void;
  close: () => void;
};

/** Bildir / engelle menüsünü her ekrandan tek satırla açmak için (menü kökte bir kez çizilir). */
export const useModerationStore = create<ModerationState>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));
