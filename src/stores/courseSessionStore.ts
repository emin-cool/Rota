import { create } from 'zustand';

/**
 * Antrenmandan başlatılan kaydın bağlamı: "Rota bul" sihirbazdan sonuç ekranına geçerken hangi
 * kurs gününün yapılacağını taşır. Kayıt başlayınca motor `course_day_id`'yi kendi kalıcı
 * oturumuna yazar ve buradaki değer temizlenir. Sihirbaz yarıda bırakılırsa ilgisiz bir kayıt
 * antrenmana yazılmasın diye değer `COURSE_CONTEXT_TTL_MS` sonra geçersiz sayılır.
 */
export const COURSE_CONTEXT_TTL_MS = 3 * 60 * 60 * 1000;

type CourseSessionState = {
  courseDayId: string | null;
  setAt: number;
  set: (courseDayId: string) => void;
  clear: () => void;
};

export const useCourseSessionStore = create<CourseSessionState>((set) => ({
  courseDayId: null,
  setAt: 0,
  set: (courseDayId) => set({ courseDayId, setAt: Date.now() }),
  clear: () => set({ courseDayId: null, setAt: 0 }),
}));

/** Süresi dolmamış antrenman bağlamı (yoksa null). */
export function freshCourseDayId(now = Date.now()): string | null {
  const { courseDayId, setAt } = useCourseSessionStore.getState();
  return courseDayId && now - setAt < COURSE_CONTEXT_TTL_MS ? courseDayId : null;
}
