import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { LngLat } from '@/lib/geo';
import {
  retrievePlace,
  suggestPlaces,
  type PlaceDetails,
  type PlaceSuggestion,
} from '@/lib/placeSearch';

/** Daha kısa yazımlarda arama yapılmaz (kota ve gürültüyü azaltır). */
export const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 350;

type State = { forQuery: string; suggestions: PlaceSuggestion[]; failed: boolean };

/**
 * Yer arama: yazdıkça (350 ms bekleyerek) Mapbox Search Box önerileri.
 * Bir "oturum" (öneriler + seçilen yerin koordinatı) tek belirteçle yapılır; seçimden sonra yenilenir.
 */
export function usePlaceSearch(query: string, proximity: LngLat | null) {
  const accessToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  const q = query.trim();
  const enabled = q.length >= MIN_QUERY_LENGTH && !!accessToken;

  const session = useRef(Crypto.randomUUID());
  const proximityRef = useRef(proximity);
  useEffect(() => {
    proximityRef.current = proximity;
  }, [proximity]);

  const [state, setState] = useState<State>({ forQuery: '', suggestions: [], failed: false });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const suggestions = await suggestPlaces(
          {
            query: q,
            sessionToken: session.current,
            accessToken: accessToken!,
            proximity: proximityRef.current,
          },
          controller.signal,
        );
        if (!controller.signal.aborted) setState({ forQuery: q, suggestions, failed: false });
      } catch {
        if (!controller.signal.aborted) setState({ forQuery: q, suggestions: [], failed: true });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, enabled, accessToken]);

  /** Seçilen önerinin adı ve koordinatını alır; oturumu yeniler. Alınamazsa null. */
  const select = useCallback(
    async (suggestion: PlaceSuggestion): Promise<PlaceDetails | null> => {
      try {
        return await retrievePlace({
          id: suggestion.id,
          sessionToken: session.current,
          accessToken: accessToken ?? '',
        });
      } catch {
        return null;
      } finally {
        session.current = Crypto.randomUUID();
      }
    },
    [accessToken],
  );

  const fresh = state.forQuery === q;
  return {
    suggestions: enabled && fresh && !state.failed ? state.suggestions : [],
    /** Yazı yeterli uzunlukta ve bu yazı için yanıt henüz gelmedi. */
    loading: enabled && !fresh,
    failed: !accessToken || (enabled && fresh && state.failed),
    /** Yeterli uzunlukta yazıldı ve yanıt geldi, ama sonuç yok. */
    empty: enabled && fresh && !state.failed && state.suggestions.length === 0,
    active: q.length >= MIN_QUERY_LENGTH,
    select,
  };
}
