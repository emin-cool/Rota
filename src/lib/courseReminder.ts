/** Kurs hatırlatıcısı: ayarlar ve hangi tarihlere bildirim kurulacağı (saf mantık, test edilebilir). */

/** Haftanın günleri ISO sırasıyla: 1 = Pazartesi … 7 = Pazar. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ReminderSettings = {
  enabled: boolean;
  /** Yerel saat, 0–23. */
  hour: number;
  /** Yerel dakika, 5'in katı (0–55). */
  minute: number;
  weekdays: IsoWeekday[];
};

/** Varsayılan: kapalı; açılırsa Pzt-Çar-Cum 18:00 (haftada 3 antrenmanlık programlara uygun). */
export const DEFAULT_REMINDER: ReminderSettings = {
  enabled: false,
  hour: 18,
  minute: 0,
  weekdays: [1, 3, 5],
};

/** Önümüzdeki kaç gün için bildirim kurulur (iOS'ta bekleyen bildirim sınırı 64). */
export const REMINDER_DAYS_AHEAD = 14;

export const MINUTE_STEP = 5;

const isWeekday = (v: unknown): v is IsoWeekday =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 7;

/** Yerel depodan okunan JSON'u güvenle çözer; bozuksa varsayılan. */
export function parseReminderSettings(json: string | null): ReminderSettings {
  if (!json) return { ...DEFAULT_REMINDER, weekdays: [...DEFAULT_REMINDER.weekdays] };
  try {
    const d = JSON.parse(json) as Partial<ReminderSettings> | null;
    if (!d || typeof d !== 'object') throw new Error('invalid');
    const hour = Number.isInteger(d.hour) && d.hour! >= 0 && d.hour! <= 23 ? d.hour! : 18;
    const rawMinute =
      Number.isInteger(d.minute) && d.minute! >= 0 && d.minute! <= 59 ? d.minute! : 0;
    const weekdays = Array.isArray(d.weekdays)
      ? [...new Set(d.weekdays.filter(isWeekday))].sort((a, b) => a - b)
      : DEFAULT_REMINDER.weekdays;
    return {
      enabled: d.enabled === true,
      hour,
      minute: Math.floor(rawMinute / MINUTE_STEP) * MINUTE_STEP,
      weekdays: weekdays as IsoWeekday[],
    };
  } catch {
    return { ...DEFAULT_REMINDER, weekdays: [...DEFAULT_REMINDER.weekdays] };
  }
}

export function serializeReminderSettings(s: ReminderSettings): string {
  return JSON.stringify(s);
}

/** Günü ekler/çıkarır (sıralı, tekrarsız). */
export function toggleWeekday(weekdays: IsoWeekday[], day: IsoWeekday): IsoWeekday[] {
  const has = weekdays.includes(day);
  const next = has ? weekdays.filter((d) => d !== day) : [...weekdays, day];
  return next.sort((a, b) => a - b) as IsoWeekday[];
}

/** Saati 24 saat içinde döner şekilde; dakikayı 5 dakikalık adımlarla, saati taşırmadan değiştirir. */
export function stepTime(
  s: Pick<ReminderSettings, 'hour' | 'minute'>,
  field: 'hour' | 'minute',
  direction: 1 | -1,
): Pick<ReminderSettings, 'hour' | 'minute'> {
  if (field === 'hour') return { hour: (s.hour + direction + 24) % 24, minute: s.minute };
  return { hour: s.hour, minute: (s.minute + direction * MINUTE_STEP + 60) % 60 };
}

export function formatReminderTime(s: Pick<ReminderSettings, 'hour' | 'minute'>): string {
  return `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
}

/** JS `getDay()` (0 = Pazar) → ISO gün (1 = Pazartesi … 7 = Pazar). */
export function isoWeekday(date: Date): IsoWeekday {
  return (date.getDay() === 0 ? 7 : date.getDay()) as IsoWeekday;
}

/**
 * Bildirim kurulacak yerel zamanlar: bugünden başlayıp `daysAhead` gün, seçili günlerde, ayarlı saatte.
 * Geçmişte kalan zamanlar ve (bugünkü antrenman yapıldıysa) bugün atlanır.
 */
export function planReminderDates(params: {
  now: Date;
  settings: ReminderSettings;
  completedToday: boolean;
  daysAhead?: number;
}): Date[] {
  const { now, settings, completedToday, daysAhead = REMINDER_DAYS_AHEAD } = params;
  if (!settings.enabled || settings.weekdays.length === 0) return [];
  const dates: Date[] = [];
  for (let i = 0; i < daysAhead; i++) {
    // `new Date(y, m, d + i, …)` yaz-kış saati geçişlerinde bile yerel saati korur.
    const at = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + i,
      settings.hour,
      settings.minute,
      0,
      0,
    );
    if (!settings.weekdays.includes(isoWeekday(at))) continue;
    if (at.getTime() <= now.getTime()) continue;
    if (i === 0 && completedToday) continue;
    dates.push(at);
  }
  return dates;
}
