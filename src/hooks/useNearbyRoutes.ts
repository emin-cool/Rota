import { useQuery } from '@tanstack/react-query';

import type { LngLat } from '@/lib/geo';
import { supabase } from '@/lib/supabase';
import type { ActivityType, NearbyRoute } from '@/types/database';

type Params = {
  center: LngLat;
  radiusM: number;
  activity: ActivityType | null;
  enabled?: boolean;
};

/** Koordinatı ~100 m'ye yuvarla: GPS titremesi her seferinde yeni sorgu başlatmasın. */
const round = (n: number) => Math.round(n * 1000) / 1000;

export function useNearbyRoutes({ center, radiusM, activity, enabled = true }: Params) {
  const [lng, lat] = center;
  return useQuery({
    queryKey: ['nearby-routes', round(lng), round(lat), radiusM, activity],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<NearbyRoute[]> => {
      const { data, error } = await supabase.rpc('nearby_routes', {
        lng: round(lng),
        lat: round(lat),
        radius_m: radiusM,
        activity,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}
