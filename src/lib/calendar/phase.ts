/**
 * Operational calendar phase — more useful than raw CONFIRMED for every row.
 * Reflects contract generation and delivery/close progress.
 */
export type CalendarPhase =
  | "SIN_CONTRATO"
  | "PENDIENTE_ENTREGA"
  | "EN_CURSO"
  | "FINALIZADA"
  | "ANULADA";

export const CALENDAR_PHASE_LABELS: Record<CalendarPhase, string> = {
  SIN_CONTRATO: "Sin contrato",
  PENDIENTE_ENTREGA: "Pendiente entrega",
  EN_CURSO: "En curso",
  FINALIZADA: "Finalizada",
  ANULADA: "Anulada",
};

export type CalendarPhaseInput = {
  reservationStatus: string;
  startAt: string;
  endAt: string;
  contractStatus?: string | null;
  contractClosedAt?: string | null;
  /** CHECK_OUT inspection exists → vehicle was delivered. */
  hasCheckOut?: boolean;
  now?: Date;
};

export function deriveCalendarPhase(input: CalendarPhaseInput): CalendarPhase {
  const status = String(input.reservationStatus ?? "").toUpperCase();
  const contractStatus = String(input.contractStatus ?? "").toUpperCase();
  const hasContract = Boolean(input.contractStatus);
  const closed = Boolean(input.contractClosedAt) || contractStatus === "COMPLETED";

  if (status === "CANCELLED" || contractStatus === "CANCELLED") {
    return "ANULADA";
  }
  if (status === "COMPLETED" || closed) {
    return "FINALIZADA";
  }
  if (status === "ACTIVE" || input.hasCheckOut) {
    return "EN_CURSO";
  }

  if (hasContract) {
    const now = input.now ?? new Date();
    const start = new Date(input.startAt);
    const end = new Date(input.endAt);
    if (
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime()) &&
      now >= start &&
      now <= end
    ) {
      return "EN_CURSO";
    }
    return "PENDIENTE_ENTREGA";
  }

  return "SIN_CONTRATO";
}

export function calendarPhaseBarClass(phase: CalendarPhase): string {
  switch (phase) {
    case "SIN_CONTRATO":
      return "bg-sky-100 text-sky-900 hover:bg-sky-200";
    case "PENDIENTE_ENTREGA":
      return "bg-amber-100 text-amber-900 hover:bg-amber-200";
    case "EN_CURSO":
      return "bg-emerald-100 text-emerald-900 hover:bg-emerald-200";
    case "FINALIZADA":
      return "bg-slate-100 text-slate-700 hover:bg-slate-200";
    case "ANULADA":
      return "bg-red-50 text-red-700/80 hover:bg-red-100";
    default:
      return "bg-brand-light text-brand hover:bg-brand-light/80";
  }
}
