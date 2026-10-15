import { create } from 'zustand';

import type { WorkoutPhase } from '@/types/database';

/**
 * Antrenmandan başlatılan kaydın bağlamı: "Rota bul" sihirbazdan sonuç ekranına geçerken hangi
 * kurs gününün (ve antrenman planının) yapılacağını taşır. Kayıt başlayınca motor bunları kendi
 * kalıcı oturumuna yazar ve buradaki değer temizlenir. Sihirbaz yarıda bırakılırsa ilgisiz bir
 * kayıt antrenmana yazılmasın diye değer `COURSE_CONTEXT_TTL_MS` sonra geçersiz sayılır.
 */
export const COURSE_CONTEXT_TTL_MS = 3 * 60 * 60 * 1000;

export type CourseContext = { courseDayId: string; workout: WorkoutPhase[] };

type CourseSessionState = {
  context: CourseContext | null;
  setAt: number;
  set: (context: CourseContext) => void;
  clear: () => void;
};

export const useCourseSessionStore = create<CourseSessionState>((set) => ({
  context: null,
  setAt: 0,
  set: (context) => set({ context, setAt: Date.now() }),
  clear: () => set({ context: null, setAt: 0 }),
}));

/** Süresi dolmamış antrenman bağlamı (yoksa null). */
export function freshCourseContext(now = Date.now()): CourseContext | null {
  const { context, setAt } = useCourseSessionStore.getState();
  return context && now - setAt < COURSE_CONTEXT_TTL_MS ? context : null;
}
