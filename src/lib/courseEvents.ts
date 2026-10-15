/**
 * Kurs günü tamamlanınca (kayıt yüklenip `complete_course_day` başarılı olunca) arayüze haber verir.
 * Yükleme kuyruğu React dışında çalıştığı için basit bir dinleyici listesi kullanılır.
 */
export type CourseDayCompletedEvent = {
  /** Kurs bu tamamlamayla bitti (rozet kazanıldı). */
  courseFinished: boolean;
};

type Listener = (event: CourseDayCompletedEvent) => void;

const listeners = new Set<Listener>();

export function onCourseDayCompleted(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitCourseDayCompleted(event: CourseDayCompletedEvent): void {
  for (const l of listeners) {
    try {
      l(event);
    } catch {
      // Bir dinleyicinin hatası yüklemeyi bozmasın.
    }
  }
}
