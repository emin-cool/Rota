import { useMemo } from 'react';

import { useNearbyRoutes } from '@/hooks/useNearbyRoutes';
import { useUserLocation } from '@/hooks/useUserLocation';
import { DEFAULT_CENTER } from '@/lib/mapConfig';
import { selectAnswers, useWizardStore } from '@/stores/wizardStore';

/** Sihirbaz adımlarındaki öneri blokları için: seçilen noktaya yakın, aktiviteye uygun rotalar (8 km). */
export function useWizardNearby() {
  const answers = useWizardStore(selectAnswers);
  const location = useUserLocation();
  const center = useMemo(
    () =>
      (answers.startIsCurrent ? location.coords : answers.start) ??
      answers.start ??
      location.coords ??
      DEFAULT_CENTER,
    [answers.startIsCurrent, answers.start, location.coords],
  );
  const query = useNearbyRoutes({
    center,
    radiusM: 8000,
    activity: answers.activityType,
    enabled: location.status !== 'loading',
  });
  return { routes: query.data ?? [], isLoading: query.isLoading, answers };
}
