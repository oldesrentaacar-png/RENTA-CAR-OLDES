import { parseISO } from "date-fns";

import { normalizeFormDateTimeToIso, rentalDaysBetween } from "@/lib/dates";
import { parseMoneyInput } from "@/lib/money";

/** Settings JSON may store the grace window as number or string. */
export function coerceGraceHours(value: unknown, fallback = 2): number {
  if (value == null || value === "") return fallback;
  const hours = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(hours)) return fallback;
  return Math.min(24, Math.max(0, hours));
}

function asInstant(value: Date | string): Date {
  if (value instanceof Date) return value;
  const normalized = normalizeFormDateTimeToIso(value);
  const parsed = parseISO(normalized || value);
  return Number.isNaN(parsed.getTime()) ? new Date(NaN) : parsed;
}

export type ExtraDayCalculationInput = {
  scheduledEndAt: Date | string;
  actualReturnAt: Date | string;
  dailyRate: number;
  graceHours?: number;
  courtesyHours?: number;
  courtesyDays?: number;
  manualExtraDaysWaived?: number;
};

export type ExtraDayCalculationResult = {
  delayHours: number;
  billedExtraDays: number;
  suggestedExtraCharge: number;
  graceHoursApplied: number;
  courtesyHoursApplied: number;
  courtesyDaysApplied: number;
};

/** Hours between scheduled end and actual return (0 if early/on time). */
export function delayHoursAfterScheduledEnd(
  scheduledEndAt: Date | string,
  actualReturnAt: Date | string,
): number {
  const scheduled = asInstant(scheduledEndAt);
  const actual = asInstant(actualReturnAt);
  const diffMs = actual.getTime() - scheduled.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
  return diffMs / (1000 * 60 * 60);
}

/**
 * Suggested extra-day charge with grace window (default 2h free) and courtesy
 * hours/days the operator may apply without changing the return timestamp.
 */
export function calculateSuggestedExtraDayCharge(
  input: ExtraDayCalculationInput,
): ExtraDayCalculationResult {
  const dailyRate = parseMoneyInput(input.dailyRate);
  const graceHours = coerceGraceHours(input.graceHours, 2);
  const courtesyHours = Math.max(0, input.courtesyHours ?? 0);
  const courtesyDays = Math.max(0, input.courtesyDays ?? 0);
  const manualWaived = Math.max(0, input.manualExtraDaysWaived ?? 0);

  const delayHours = delayHoursAfterScheduledEnd(
    input.scheduledEndAt,
    input.actualReturnAt,
  );

  const hoursPastGrace = Math.max(0, delayHours - graceHours - courtesyHours);
  let billedExtraDays =
    hoursPastGrace > 0 ? Math.max(1, Math.ceil(hoursPastGrace / 24)) : 0;
  const courtesyHoursAsDays =
    courtesyHours >= 24 ? Math.floor(courtesyHours / 24) : 0;
  const totalCourtesyDays = courtesyDays + courtesyHoursAsDays;
  billedExtraDays = Math.max(0, billedExtraDays - courtesyDays - manualWaived);

  return {
    delayHours: Math.round(delayHours * 10) / 10,
    billedExtraDays,
    suggestedExtraCharge: billedExtraDays * dailyRate,
    graceHoursApplied: graceHours,
    courtesyHoursApplied: courtesyHours,
    courtesyDaysApplied: totalCourtesyDays,
  };
}

export type ReturnSettlement = {
  agreedDays: number;
  actualDays: number;
  /** Days past the agreed end, after the courtesy window. */
  extraDays: number;
  /** Full rental days not used because the car came back early. */
  unusedDays: number;
  extraCharge: number;
  earlyCredit: number;
  /** Positive adds to the bill. Negative reduces it. */
  dayAdjustment: number;
  returnedEarly: boolean;
};

/**
 * Late return adds days. Early return subtracts unused days.
 * The original contract total stays the agreed price; this is only the difference.
 */
export function calculateReturnSettlement(input: {
  startAt: Date | string;
  scheduledEndAt: Date | string;
  actualReturnAt: Date | string;
  dailyRate: number;
  graceHours?: number;
  courtesyHours?: number;
  courtesyDays?: number;
  manualExtraDaysWaived?: number;
}): ReturnSettlement {
  const dailyRate = parseMoneyInput(input.dailyRate);
  const scheduled = asInstant(input.scheduledEndAt);
  const actual = asInstant(input.actualReturnAt);
  const agreedDays = rentalDaysBetween(input.startAt, input.scheduledEndAt);
  const actualDays = rentalDaysBetween(input.startAt, input.actualReturnAt);
  const returnedEarly =
    Number.isFinite(actual.getTime()) &&
    Number.isFinite(scheduled.getTime()) &&
    actual.getTime() < scheduled.getTime();

  const late = calculateSuggestedExtraDayCharge({
    scheduledEndAt: input.scheduledEndAt,
    actualReturnAt: input.actualReturnAt,
    dailyRate,
    graceHours: input.graceHours,
    courtesyHours: input.courtesyHours,
    courtesyDays: input.courtesyDays,
    manualExtraDaysWaived: input.manualExtraDaysWaived,
  });

  const unusedDays = returnedEarly
    ? Math.max(0, agreedDays - actualDays)
    : 0;
  const earlyCredit = Math.round(unusedDays * dailyRate * 100) / 100;
  const extraCharge = returnedEarly ? 0 : late.suggestedExtraCharge;
  const extraDays = returnedEarly ? 0 : late.billedExtraDays;

  return {
    agreedDays,
    actualDays,
    extraDays,
    unusedDays,
    extraCharge,
    earlyCredit,
    dayAdjustment: Math.round((extraCharge - earlyCredit) * 100) / 100,
    returnedEarly,
  };
}
