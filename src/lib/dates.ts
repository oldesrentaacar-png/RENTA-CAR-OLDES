import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  formatInTimeZone,
  fromZonedTime,
  toZonedTime,
} from "date-fns-tz";

export const APP_TIMEZONE = "America/El_Salvador";

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
  const value = typeof date === "string" ? parseISO(date) : date;
  return formatInTimeZone(value, APP_TIMEZONE, pattern, { locale: es });
}

export function formatAppDate(date: Date | string): string {
  return formatInAppTimezone(date, "dd/MM/yyyy");
}

export function formatAppDateTime(date: Date | string): string {
  return formatInAppTimezone(date, "dd/MM/yyyy HH:mm");
}

export function formatAppTime(date: Date | string): string {
  return formatInAppTimezone(date, "HH:mm");
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
export function appTodayDateString(): string {
  return formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
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
