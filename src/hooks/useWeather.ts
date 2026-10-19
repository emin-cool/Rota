import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useUserLocation } from '@/hooks/useUserLocation';
import { DEFAULT_CENTER } from '@/lib/mapConfig';
import type { LngLat } from '@/lib/geo';
import { fetchWeather, weatherCell } from '@/lib/weatherApi';
import { useSessionStore } from '@/stores/sessionStore';

/** Tahmin yarım saat önbellekli; uygulama içinde 10 dk'da bir tazelenir. */
const STALE_MS = 10 * 60_000;

/** Verilen konum (yoksa İstanbul merkezi) için hava durumu. */
export function useWeather(coords: LngLat | null, enabled = true) {
  const userId = useSessionStore((s) => s.session?.user.id);
  const cell = useMemo(() => weatherCell(coords ?? DEFAULT_CENTER), [coords]);
  const query = useQuery({
    queryKey: ['weather', cell.key],
    enabled: enabled && !!userId,
    staleTime: STALE_MS,
    retry: 1,
    queryFn: () => fetchWeather(cell),
  });
  return { ...query, usingDefaultLocation: coords === null };
}

/** Kullanıcının konumu için hava durumu (konum izni yoksa İstanbul merkezi). */
export function useLocalWeather(enabled = true) {
  const location = useUserLocation();
  // Konum çözülene kadar sorgu atma: önce varsayılan hücre, sonra gerçek hücre çekilmesin.
  const ready = location.status !== 'loading';
  return useWeather(location.coords, enabled && ready);
}
