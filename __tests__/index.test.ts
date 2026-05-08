import {
  formatDate,
  formatTime,
  formatDateTime,
  formatRelative,
  parseDate,
  addDays,
  addMonths,
  daysBetween,
  isLeapYear,
  daysInMonth,
  normalizeDateInput,
  normalizeTimeInput,
  normalizeDateTimeInput,
} from '../src/index';

describe('formatDate', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(formatDate(new Date(2024, 0, 5))).toBe('2024-01-05');
  });

  it('pads single-digit months and days', () => {
    expect(formatDate(new Date(2024, 2, 9))).toBe('2024-03-09');
  });
});

describe('formatTime', () => {
  it('formats time as HH:MM:SS', () => {
    const d = new Date(2024, 0, 1, 14, 5, 9);
    expect(formatTime(d)).toBe('14:05:09');
  });
});

describe('formatDateTime', () => {
  it('combines date and time', () => {
    const d = new Date(2024, 5, 15, 8, 30, 0);
    expect(formatDateTime(d)).toBe('2024-06-15 08:30:00');
  });
});

describe('formatRelative', () => {
  const now = new Date(2024, 0, 15, 12, 0, 0);

  it('formats past days', () => {
    const past = new Date(2024, 0, 12, 12, 0, 0);
    expect(formatRelative(past, now)).toBe('3 days ago');
  });

  it('formats future hours', () => {
    const future = new Date(2024, 0, 15, 14, 0, 0);
    expect(formatRelative(future, now)).toBe('in 2 hours');
  });

  it('formats singular units', () => {
    const oneDay = new Date(2024, 0, 14, 12, 0, 0);
    expect(formatRelative(oneDay, now)).toBe('1 day ago');
  });
});

describe('parseDate', () => {
  it('parses valid YYYY-MM-DD', () => {
    const result = parseDate('2024-03-15');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(15);
  });

  it('returns null for invalid format', () => {
    expect(parseDate('15-03-2024')).toBeNull();
    expect(parseDate('not-a-date')).toBeNull();
  });

  it('returns null for invalid month', () => {
    expect(parseDate('2024-13-01')).toBeNull();
  });
});

describe('addDays', () => {
  it('adds positive days', () => {
    const result = addDays(new Date(2024, 0, 30), 3);
    expect(formatDate(result)).toBe('2024-02-02');
  });

  it('subtracts with negative days', () => {
    const result = addDays(new Date(2024, 0, 5), -10);
    expect(formatDate(result)).toBe('2023-12-26');
  });
});

describe('addMonths', () => {
  it('adds months normally', () => {
    const result = addMonths(new Date(2024, 0, 15), 2);
    expect(formatDate(result)).toBe('2024-03-15');
  });

  it('clamps to end of month on overflow', () => {
    const result = addMonths(new Date(2024, 0, 31), 1);
    expect(formatDate(result)).toBe('2024-02-29');
  });
});

describe('daysBetween', () => {
  it('calculates days between two dates', () => {
    const a = new Date(2024, 0, 1);
    const b = new Date(2024, 0, 10);
    expect(daysBetween(a, b)).toBe(9);
  });

  it('is symmetric', () => {
    const a = new Date(2024, 0, 1);
    const b = new Date(2024, 0, 10);
    expect(daysBetween(b, a)).toBe(9);
  });
});

describe('isLeapYear', () => {
  it('identifies leap years', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
  });

  it('identifies non-leap years', () => {
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
  });
});

describe('daysInMonth', () => {
  it('returns correct days for each month', () => {
    expect(daysInMonth(2024, 1)).toBe(31);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(2024, 4)).toBe(30);
  });

  it('throws on invalid month', () => {
    expect(() => daysInMonth(2024, 0)).toThrow();
    expect(() => daysInMonth(2024, 13)).toThrow();
  });
});

describe('normalize functions', () => {
  it('trims and lowercases', () => {
    expect(normalizeDateInput('  2024-01-01  ')).toBe('2024-01-01');
    expect(normalizeTimeInput('  14:30:00  ')).toBe('14:30:00');
    expect(normalizeDateTimeInput('  2024-01-01  14:30:00  ')).toBe('2024-01-01 14:30:00');
  });
});
