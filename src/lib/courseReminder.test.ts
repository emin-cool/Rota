import {
  DEFAULT_REMINDER,
  formatReminderTime,
  isoWeekday,
  parseReminderSettings,
  planReminderDates,
  serializeReminderSettings,
  stepTime,
  toggleWeekday,
  type ReminderSettings,
} from './courseReminder';

const on = (over: Partial<ReminderSettings> = {}): ReminderSettings => ({
  ...DEFAULT_REMINDER,
  enabled: true,
  ...over,
});

describe('parse / serialize', () => {
  it('geçerli ayarı olduğu gibi geri okur', () => {
    const s = on({ hour: 7, minute: 30, weekdays: [2, 4] });
    expect(parseReminderSettings(serializeReminderSettings(s))).toEqual(s);
  });

  it('boş ya da bozuk JSON varsayılana (kapalı) döner', () => {
    expect(parseReminderSettings(null)).toEqual(DEFAULT_REMINDER);
    expect(parseReminderSettings('{bozuk')).toEqual(DEFAULT_REMINDER);
    expect(parseReminderSettings('null')).toEqual(DEFAULT_REMINDER);
  });

  it('geçersiz alanları düzeltir: saat, dakika adımı, günler', () => {
    const s = parseReminderSettings(
      JSON.stringify({ enabled: true, hour: 99, minute: 33, weekdays: [5, 5, 0, 9, 1, 'x'] }),
    );
    expect(s).toEqual({ enabled: true, hour: 18, minute: 30, weekdays: [1, 5] });
  });

  it('enabled yalnızca true ise açıktır', () => {
    expect(parseReminderSettings(JSON.stringify({ enabled: 'yes' })).enabled).toBe(false);
  });
});

describe('toggleWeekday / stepTime / format', () => {
  it('günü ekler ve çıkarır, sıralı tutar', () => {
    expect(toggleWeekday([1, 5], 3)).toEqual([1, 3, 5]);
    expect(toggleWeekday([1, 3, 5], 3)).toEqual([1, 5]);
  });

  it('saat 24 saatte döner, dakika 5 dakikalık adımla ve saati taşırmadan döner', () => {
    expect(stepTime({ hour: 23, minute: 0 }, 'hour', 1)).toEqual({ hour: 0, minute: 0 });
    expect(stepTime({ hour: 0, minute: 0 }, 'hour', -1)).toEqual({ hour: 23, minute: 0 });
    expect(stepTime({ hour: 18, minute: 55 }, 'minute', 1)).toEqual({ hour: 18, minute: 0 });
    expect(stepTime({ hour: 18, minute: 0 }, 'minute', -1)).toEqual({ hour: 18, minute: 55 });
    expect(stepTime({ hour: 18, minute: 30 }, 'minute', 1)).toEqual({ hour: 18, minute: 35 });
  });

  it('saati iki haneli yazar', () => {
    expect(formatReminderTime({ hour: 7, minute: 5 })).toBe('07:05');
  });

  it('ISO gün: Pazartesi 1, Pazar 7', () => {
    expect(isoWeekday(new Date(2026, 9, 12))).toBe(1); // 12 Ekim 2026 Pazartesi
    expect(isoWeekday(new Date(2026, 9, 18))).toBe(7); // Pazar
  });
});

describe('planReminderDates', () => {
  // 14 Ekim 2026 Çarşamba 10:00
  const now = new Date(2026, 9, 14, 10, 0, 0);

  it('kapalıyken ya da gün seçili değilken boş döner', () => {
    expect(planReminderDates({ now, settings: DEFAULT_REMINDER, completedToday: false })).toEqual(
      [],
    );
    expect(
      planReminderDates({ now, settings: on({ weekdays: [] }), completedToday: false }),
    ).toEqual([]);
  });

  it('seçili günlerde, ayarlı saatte, 14 gün içinde zamanlar (Pzt-Çar-Cum)', () => {
    const dates = planReminderDates({ now, settings: on(), completedToday: false });
    expect(dates.map((d) => [d.getDate(), d.getHours(), d.getMinutes()])).toEqual([
      [14, 18, 0], // Çar (bugün)
      [16, 18, 0], // Cum
      [19, 18, 0], // Pzt
      [21, 18, 0], // Çar
      [23, 18, 0], // Cum
      [26, 18, 0], // Pzt
    ]);
  });

  it('bugünün saati geçtiyse bugünü atlar', () => {
    const late = new Date(2026, 9, 14, 19, 0, 0);
    const dates = planReminderDates({ now: late, settings: on(), completedToday: false });
    expect(dates[0]!.getDate()).toBe(16);
  });

  it('bugünkü antrenman yapıldıysa yalnızca bugünü atlar', () => {
    const dates = planReminderDates({ now, settings: on(), completedToday: true });
    expect(dates[0]!.getDate()).toBe(16);
    expect(dates).toHaveLength(5);
  });

  it('daysAhead ile sınırlanır', () => {
    const dates = planReminderDates({ now, settings: on(), completedToday: false, daysAhead: 3 });
    expect(dates.map((d) => d.getDate())).toEqual([14, 16]);
  });
});
