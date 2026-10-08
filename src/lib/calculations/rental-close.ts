import { parseISO } from "date-fns";

import { normalizeFormDateTimeToIso } from "@/lib/dates";
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
