import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/types/database';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** `.env` doldurulmadıysa uygulama çökmesin; giriş ekranı uyarı göstersin. */
export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes('xxxx'));

if (!isSupabaseConfigured) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlı değil (.env).',
  );
}

/**
 * Oturum token'ları Keychain/Keystore'da (expo-secure-store) saklanır.
 * Web'de SecureStore yok; yalnızca geliştirme önizlemesi için localStorage'a düşer.
 */
const storage =
  Platform.OS === 'web'
    ? {
        getItem: async (key: string) =>
          typeof localStorage === 'undefined' ? null : localStorage.getItem(key),
        setItem: async (key: string, value: string) => {
          if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
        },
        removeItem: async (key: string) => {
          if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
        },
      }
    : {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      };

export const supabase = createClient<Database>(
  isSupabaseConfigured ? url! : 'http://localhost:54321',
  isSupabaseConfigured ? anonKey! : 'public-anon-key-not-configured',
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      // Mobilde OAuth dönüşünü kendimiz işliyoruz (src/lib/auth.ts).
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  },
);

// Uygulama arka plana gidince token yenilemeyi durdur, dönünce başlat (Supabase önerisi).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
