/**
 * Format a Date as YYYY-MM-DD.
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format a Date as HH:MM:SS.
 */
export function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${min}:${s}`;
}

/**
 * Format a Date as YYYY-MM-DD HH:MM:SS.
 */
export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * Format a Date as a relative string (e.g., "3 days ago", "in 2 hours").
 */
export function formatRelative(date: Date, now?: Date): string {
  const reference = now ?? new Date();
  const diffMs = date.getTime() - reference.getTime();
  const absDiffMs = Math.abs(diffMs);
  const past = diffMs < 0;

  const seconds = Math.floor(absDiffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let label: string;
  if (days > 0) {
    label = `${days} day${days === 1 ? '' : 's'}`;
  } else if (hours > 0) {
    label = `${hours} hour${hours === 1 ? '' : 's'}`;
  } else if (minutes > 0) {
    label = `${minutes} minute${minutes === 1 ? '' : 's'}`;
  } else {
    label = `${seconds} second${seconds === 1 ? '' : 's'}`;
  }

  return past ? `${label} ago` : `in ${label}`;
}

/**
 * Parse a date string in YYYY-MM-DD format. Returns null on invalid input.
 */
export function parseDate(input: string): Date | null {
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, yearStr, monthStr, dayStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
}

/**
 * Add days to a date, returning a new Date.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add months to a date, returning a new Date.
 * If the resulting month has fewer days, clamps to the last day.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  // Handle month overflow (e.g., Jan 31 + 1 month → Feb 28)
  if (result.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    result.setDate(0); // last day of previous month
  }
  return result;
}

/**
 * Calculate the number of days between two dates (absolute value).
 */
export function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.abs(Math.floor((utcB - utcA) / msPerDay));
}

/**
 * Check if a year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Get the number of days in a given month (1-indexed).
 */
export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}`);
  }
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1];
}

/**
 * Trim surrounding whitespace, collapse internal whitespace runs to a single space, and lowercase.
 */
export function normalizeInput(input: string): string {
  return input.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Normalize a date string input before parsing.
 */
export function normalizeDateInput(input: string): string {
  return input.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Normalize a time string input before parsing.
 */
export function normalizeTimeInput(input: string): string {
  return input.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Normalize a datetime string input before parsing.
 */
export function normalizeDateTimeInput(input: string): string {
  return input.trim().replace(/\s+/g, ' ').toLowerCase();
}
