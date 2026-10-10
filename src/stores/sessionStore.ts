import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { fetchMyProfile, updateMyProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import type { ProfileRow, ProfileUpdate } from '@/types/database';

type SessionState = {
  /** İlk oturum kontrolü bitti mi? (splash'ı bekletmek için) */
  initialized: boolean;
  session: Session | null;
  profile: ProfileRow | null;
  profileError: boolean;
  /** Uygulama açılışında bir kez çağır; abonelik temizleyicisini döner. */
  init: () => () => void;
  refreshProfile: () => Promise<void>;
  patchProfile: (patch: ProfileUpdate) => Promise<void>;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  initialized: false,
  session: null,
  profile: null,
  profileError: false,

  init: () => {
    let active = true;

    const apply = async (session: Session | null) => {
      if (!active) return;
      if (!session) {
        set({ session: null, profile: null, profileError: false, initialized: true });
        return;
      }
      set({ session });
      try {
        // Trigger profili kayıttan hemen sonra oluşturur; yarış olursa kısa süre tekrar dene.
        let profile = await fetchMyProfile(session.user.id);
        for (let i = 0; !profile && i < 3; i++) {
          await new Promise((r) => setTimeout(r, 400));
          profile = await fetchMyProfile(session.user.id);
        }
        if (active) set({ profile, profileError: !profile, initialized: true });
      } catch {
        if (active) set({ profile: null, profileError: true, initialized: true });
      }
    };

    void supabase.auth.getSession().then(({ data }) => apply(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // onAuthStateChange içinde supabase çağrısını await etme (kilitlenme); sonraya at.
      if (event === 'INITIAL_SESSION') return; // getSession ile işlendi
      if (event === 'TOKEN_REFRESHED' && session) {
        set({ session });
        return;
      }
      setTimeout(() => void apply(session), 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  },

  refreshProfile: async () => {
    const userId = get().session?.user.id;
    if (!userId) return;
    try {
      const profile = await fetchMyProfile(userId);
      set({ profile, profileError: !profile });
    } catch {
      set({ profileError: true });
    }
  },

  patchProfile: async (patch) => {
    const userId = get().session?.user.id;
    if (!userId) throw new Error('Oturum yok');
    const profile = await updateMyProfile(userId, patch);
    set({ profile });
  },
}));
