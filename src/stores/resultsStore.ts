import { create } from 'zustand';

import type { GenerateRoutesInput, RouteOption } from '@/types/routes';

type ResultsState = {
  /** Sonuçları üreten girdi (başlık, kaydetme ve paylaşma için). */
  input: GenerateRoutesInput | null;
  startName: string | null;
  routes: RouteOption[];
  warnings: string[];
  selected: number;
  /** Kaydedilen kartlar: kart indeksi → routes tablosundaki id. */
  savedRouteIds: Record<number, string>;
  setResults: (r: {
    input: GenerateRoutesInput;
    startName: string | null;
    routes: RouteOption[];
    warnings?: string[];
  }) => void;
  select: (index: number) => void;
  markSaved: (index: number, routeId: string | null) => void;
  clear: () => void;
};

export const useResultsStore = create<ResultsState>((set) => ({
  input: null,
  startName: null,
  routes: [],
  warnings: [],
  selected: 0,
  savedRouteIds: {},
  setResults: ({ input, startName, routes, warnings }) =>
    set({ input, startName, routes, warnings: warnings ?? [], selected: 0, savedRouteIds: {} }),
  select: (selected) => set({ selected }),
  markSaved: (index, routeId) =>
    set((s) => {
      const next = { ...s.savedRouteIds };
      if (routeId) next[index] = routeId;
      else delete next[index];
      return { savedRouteIds: next };
    }),
  clear: () =>
    set({ input: null, startName: null, routes: [], warnings: [], selected: 0, savedRouteIds: {} }),
}));
