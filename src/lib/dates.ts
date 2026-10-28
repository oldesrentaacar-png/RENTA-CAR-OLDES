import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  formatInTimeZone,
  fromZonedTime,
  toZonedTime,
} from "date-fns-tz";

export const APP_TIMEZONE = "America/El_Salvador";

/**
 * Postgres `date` columns come back as `YYYY-MM-DD` (no time).
 * parseISO treats that as UTC midnight, which is the previous afternoon
 * in El Salvador and shifts the calendar day back by one.
 */
function calendarDateYmd(value: Date | string): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)) return null;
  const match = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})(?:[T ]00:00(?::00(?:\.\d+)?)?)?$/,
  );
  return match?.[1] ?? null;
}

function formatCalendarYmd(ymd: string, pattern: string): string {
  const [year, month, day] = ymd.split("-");
  if (pattern === "dd/MM/yyyy") return `${day}/${month}/${year}`;
  if (pattern === "yyyy-MM-dd") return ymd;
  const noon = fromZonedTime(`${ymd}T12:00:00`, APP_TIMEZONE);
  return formatInTimeZone(noon, APP_TIMEZONE, pattern, { locale: es });
}

export function nowUtc(): Date {
  return new Date();
}

export function toAppTimezone(date: Date | string): Date {
  const value = typeof date === "string" ? parseISO(date) : date;
  return toZonedTime(value, APP_TIMEZONE);
}

export function formatInAppTimezone(
  date: Date | string,
  pattern: string = "dd/MM/yyyy HH:mm",
): string {
  const ymd = calendarDateYmd(date);
  if (ymd) return formatCalendarYmd(ymd, pattern);
  const value = typeof date === "string" ? parseISO(date) : date;
  return formatInTimeZone(value, APP_TIMEZONE, pattern, { locale: es });
}

export function formatAppDate(date: Date | string): string {
  return formatInAppTimezone(date, "dd/MM/yyyy");
}

/** YYYY-MM-DD for `<input type="date" />`, in El Salvador when the value has a time. */
export function toDateInputValue(date?: Date | string | null): string {
  if (!date) return appTodayDateString();
  const ymd = calendarDateYmd(date);
  if (ymd) return ymd;
  return utcToAppLocalParts(date).date;
}

export function formatAppDateTime(date: Date | string): string {
  return formatInAppTimezone(date, "dd/MM/yyyy HH:mm");
}

export function formatAppTime(date: Date | string): string {
  return formatInAppTimezone(date, "HH:mm");
}

/** Hora legible para operaciones: "8:00 p. m." */
export function formatAppTime12h(date: Date | string): string {
  return formatInAppTimezone(date, "h:mm a");
}

/** Fecha + hora legible: "21/09/2026 · 8:00 p. m." */
export function formatAppDateTime12h(date: Date | string): string {
  return `${formatAppDate(date)} · ${formatAppTime12h(date)}`;
}

/**
 * Combines a local date (YYYY-MM-DD) and time (HH:mm) in El Salvador
 * and returns the equivalent UTC Date for storage.
 */
export function appLocalDateTimeToUtc(date: string, time: string): Date {
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  return fromZonedTime(`${date}T${normalizedTime}`, APP_TIMEZONE);
}

export function utcToAppLocalParts(date: Date | string): {
  date: string;
  time: string;
} {
  const value = typeof date === "string" ? parseISO(date) : date;
  return {
    date: formatInTimeZone(value, APP_TIMEZONE, "yyyy-MM-dd"),
    time: formatInTimeZone(value, APP_TIMEZONE, "HH:mm"),
  };
}

export function rentalDaysBetween(
  startAt: Date | string,
  endAt: Date | string,
): number {
  const start =
    typeof startAt === "string"
      ? parseISO(normalizeFormDateTimeToIso(startAt))
      : startAt;
  const end =
    typeof endAt === "string"
      ? parseISO(normalizeFormDateTimeToIso(endAt))
      : endAt;
  const diffMs = end.getTime() - start.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return 1;
  }
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(days, 1);
}

/** Value for `<input type="datetime-local" />` in El Salvador time. */
export function toDatetimeLocalValue(date: Date | string): string {
  const parts = utcToAppLocalParts(date);
  return `${parts.date}T${parts.time}`;
}

/**
 * Accepts ISO or `YYYY-MM-DDTHH:mm` from datetime-local and returns ISO UTC.
 * Empty/invalid values are returned as-is for Zod to reject.
 */
export function normalizeFormDateTimeToIso(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  // Already has timezone / Z
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const parsed = parseISO(trimmed);
    return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
  }

  const match = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/,
  );
  if (!match) return trimmed;

  const [, datePart, timePart] = match;
  return appLocalDateTimeToUtc(datePart, timePart).toISOString();
}

export function formatRelativeAppDate(date: Date | string): string {
  const value = typeof date === "string" ? parseISO(date) : date;
  const zoned = toAppTimezone(value);
  return format(zoned, "PPP", { locale: es });
}

/** Today's calendar date (YYYY-MM-DD) in America/El_Salvador. */
export function appTodayDateString(date = new Date()): string {
  return formatInTimeZone(date, APP_TIMEZONE, "yyyy-MM-dd");
}

/** Calendar month YYYY-MM in America/El_Salvador, not UTC. */
export function appYearMonth(date = new Date()): string {
  return formatInTimeZone(date, APP_TIMEZONE, "yyyy-MM");
}

/**
 * Inclusive start / exclusive end UTC bounds for a calendar day in app timezone.
 * `dayOffset` 0 = today, 1 = tomorrow, etc.
 */
export function getAppDayBounds(dayOffset = 0): {
  date: string;
  startIso: string;
  endExclusiveIso: string;
} {
  const today = appTodayDateString();
  const noonUtc = fromZonedTime(`${today}T12:00:00`, APP_TIMEZONE);
  const shifted = new Date(noonUtc.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  const date = formatInTimeZone(shifted, APP_TIMEZONE, "yyyy-MM-dd");
  const nextNoon = new Date(shifted.getTime() + 24 * 60 * 60 * 1000);
  const nextDate = formatInTimeZone(nextNoon, APP_TIMEZONE, "yyyy-MM-dd");
  return {
    date,
    startIso: appLocalDateTimeToUtc(date, "00:00").toISOString(),
    endExclusiveIso: appLocalDateTimeToUtc(nextDate, "00:00").toISOString(),
  };
}
