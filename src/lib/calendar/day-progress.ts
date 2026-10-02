import {
  differenceInCalendarDays,
  parseISO,
  startOfDay,
} from "date-fns";

import type { CalendarPhase } from "@/lib/calendar/phase";

export type RentalDayRole = "ENTREGAR" | "EN_RENTA" | "RECIBIR";

export type RentalDayProgress = {
  /** 1-based day within the rental span (inclusive). */
  dayIndex: number;
  totalDays: number;
  role: RentalDayRole;
  /** Google-style short: "2/5". */
  fraction: string;
  /** Action chip for ops: Entregar / En renta / Recibir. */
  roleLabel: string;
  /** Full line for UI: "Día 2/5 · En renta". */
  label: string;
};

const ROLE_LABELS: Record<RentalDayRole, string> = {
  ENTREGAR: "Entregar",
  EN_RENTA: "En renta",
  RECIBIR: "Recibir",
};

/**
 * Where we are inside a multi-day rental on a given calendar day —
 * same idea as Google Calendar "day X of Y" on long events.
 */
export function getRentalDayProgress(
  startAt: string,
  endAt: string,
  day: Date,
): RentalDayProgress | null {
  const start = startOfDay(parseISO(startAt));
  const end = startOfDay(parseISO(endAt));
  const d = startOfDay(day);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (d < start || d > end) return null;

  const totalDays = Math.max(1, differenceInCalendarDays(end, start) + 1);
  const dayIndex = Math.min(
    totalDays,
    Math.max(1, differenceInCalendarDays(d, start) + 1),
  );

  let role: RentalDayRole = "EN_RENTA";
  if (dayIndex === 1 && totalDays === 1) {
    // Same-day: both deliver and return today.
    role = "ENTREGAR";
  } else if (dayIndex === 1) {
    role = "ENTREGAR";
  } else if (dayIndex === totalDays) {
    role = "RECIBIR";
  }

  const fraction = `${dayIndex}/${totalDays}`;
  const roleLabel =
    dayIndex === 1 && totalDays === 1 ? "Entregar / Recibir" : ROLE_LABELS[role];

  return {
    dayIndex,
    totalDays,
    role: dayIndex === 1 && totalDays === 1 ? "ENTREGAR" : role,
    fraction,
    roleLabel,
    label: `Día ${fraction} · ${roleLabel}`,
  };
}

export function rentalDayRoleClass(role: RentalDayRole): string {
  switch (role) {
    case "ENTREGAR":
      return "bg-amber-100 text-amber-950";
    case "RECIBIR":
      return "bg-violet-100 text-violet-950";
    case "EN_RENTA":
    default:
      return "bg-emerald-100 text-emerald-950";
  }
}

/** Prefer operational day role over static phase for day labels. */
export function dayActionHint(
  progress: RentalDayProgress | null,
  phase: CalendarPhase,
): string {
  if (!progress) return "";
  if (progress.totalDays === 1) return "Entregar y recibir hoy";
  if (progress.role === "ENTREGAR") return "Hoy toca entregar";
  if (progress.role === "RECIBIR") return "Hoy toca recibir";
  return `Día ${progress.fraction} de la renta (${phase})`;
}
