import { parseISO } from "date-fns";

import { rentalDaysBetween } from "@/lib/dates";
import { parseMoneyInput } from "@/lib/money";

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
  const scheduled =
    typeof scheduledEndAt === "string"
      ? parseISO(scheduledEndAt)
      : scheduledEndAt;
  const actual =
    typeof actualReturnAt === "string"
      ? parseISO(actualReturnAt)
      : actualReturnAt;
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
  const graceHours = Math.max(0, input.graceHours ?? 2);
  const courtesyHours = Math.max(0, input.courtesyHours ?? 0);
  const courtesyDays = Math.max(0, input.courtesyDays ?? 0);
  const manualWaived = Math.max(0, input.manualExtraDaysWaived ?? 0);

  const delayHours = delayHoursAfterScheduledEnd(
    input.scheduledEndAt,
    input.actualReturnAt,
  );

  let billedExtraDays = 0;
  if (delayHours > graceHours) {
    const billableEnd = parseISO(
      typeof input.actualReturnAt === "string"
        ? input.actualReturnAt
        : input.actualReturnAt.toISOString(),
    );
    const scheduledEnd = parseISO(
      typeof input.scheduledEndAt === "string"
        ? input.scheduledEndAt
        : input.scheduledEndAt.toISOString(),
    );
    billedExtraDays = Math.max(
      0,
      rentalDaysBetween(scheduledEnd, billableEnd) - 1,
    );
    if (billedExtraDays === 0 && delayHours > graceHours) {
      billedExtraDays = 1;
    }
  }

  const courtesyHoursAsDays =
    courtesyHours >= 24
      ? Math.floor(courtesyHours / 24)
      : courtesyHours >= graceHours && billedExtraDays > 0
        ? 1
        : 0;

  const totalCourtesyDays = courtesyDays + courtesyHoursAsDays;
  billedExtraDays = Math.max(0, billedExtraDays - totalCourtesyDays - manualWaived);

  return {
    delayHours: Math.round(delayHours * 10) / 10,
    billedExtraDays,
    suggestedExtraCharge: billedExtraDays * dailyRate,
    graceHoursApplied: graceHours,
    courtesyHoursApplied: courtesyHours,
    courtesyDaysApplied: totalCourtesyDays,
  };
}
