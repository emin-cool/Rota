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
  /** `routes`'a eklenmiş kartlar (kayıtlıdan çıkarılsa da, aktivite için eklenmiş olsa da kalır). */
  insertedRouteIds: Record<number, string>;
  setResults: (r: {
    input: GenerateRoutesInput;
    startName: string | null;
    routes: RouteOption[];
    warnings?: string[];
  }) => void;
  select: (index: number) => void;
  markSaved: (index: number, routeId: string | null) => void;
  markInserted: (index: number, routeId: string) => void;
  clear: () => void;
};

export const useResultsStore = create<ResultsState>((set) => ({
  input: null,
  startName: null,
  routes: [],
  warnings: [],
  selected: 0,
  savedRouteIds: {},
  insertedRouteIds: {},
  setResults: ({ input, startName, routes, warnings }) =>
    set({
      input,
      startName,
      routes,
      warnings: warnings ?? [],
      selected: 0,
      savedRouteIds: {},
      insertedRouteIds: {},
    }),
  select: (selected) => set({ selected }),
  markSaved: (index, routeId) =>
    set((s) => {
      const next = { ...s.savedRouteIds };
      if (routeId) next[index] = routeId;
      else delete next[index];
      return { savedRouteIds: next };
    }),
  markInserted: (index, routeId) =>
    set((s) => ({ insertedRouteIds: { ...s.insertedRouteIds, [index]: routeId } })),
  clear: () =>
    set({
      input: null,
      startName: null,
      routes: [],
      warnings: [],
      selected: 0,
      savedRouteIds: {},
      insertedRouteIds: {},
    }),
}));
