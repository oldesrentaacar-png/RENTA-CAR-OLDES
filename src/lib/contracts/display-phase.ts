/**
 * Operational display phase for contracts list (aligned with calendar language).
 * DB status (CLIENT_SIGNED, etc.) stays for signature workflow.
 */
export type ContractDisplayPhase =
  | "FINALIZADO"
  | "EN_CURSO"
  | "ANULADO"
  | "SIN_RESOLVER"
  | "POR_LIQUIDAR"
  | "FALTA_CERRAR";

export const CONTRACT_DISPLAY_PHASE_LABELS: Record<
  ContractDisplayPhase,
  string
> = {
  FINALIZADO: "Finalizado",
  EN_CURSO: "En curso",
  ANULADO: "Anulado",
  SIN_RESOLVER: "Sin resolver",
  POR_LIQUIDAR: "Por liquidar",
  FALTA_CERRAR: "Falta cerrar",
};

export const CONTRACT_DISPLAY_PHASE_OPTIONS: Array<{
  value: ContractDisplayPhase;
  label: string;
}> = [
  { value: "FALTA_CERRAR", label: "Falta cerrar (ingreso hecho)" },
  { value: "POR_LIQUIDAR", label: "Por liquidar (saldo)" },
  { value: "EN_CURSO", label: "En curso" },
  { value: "SIN_RESOLVER", label: "Sin resolver" },
  { value: "FINALIZADO", label: "Finalizado" },
  { value: "ANULADO", label: "Anulado" },
];

/** Closed for operations: Cerrar renta, or cancelled. Saldo is billing, not open. */
export function isContractClosed(input: {
  status?: string | null;
  closedAt?: string | null;
}): boolean {
  const status = String(input.status ?? "").toUpperCase();
  return (
    status === "COMPLETED" ||
    status === "CANCELLED" ||
    Boolean(input.closedAt)
  );
}

export function isContractOpen(input: {
  status?: string | null;
  closedAt?: string | null;
}): boolean {
  return !isContractClosed(input);
}

export function deriveContractDisplayPhase(input: {
  status: string;
  closedAt?: string | null;
  endAt: string;
  balanceDue?: number | null;
  now?: Date;
  /** CHECK_IN exists — vehicle return started; Cerrar renta still pending. */
  hasCheckIn?: boolean;
}): ContractDisplayPhase {
  const status = String(input.status ?? "").toUpperCase();
  const now = input.now ?? new Date();
  const balanceDue = Number(input.balanceDue ?? 0);

  if (status === "CANCELLED") return "ANULADO";
  if (isContractClosed({ status, closedAt: input.closedAt })) {
    return "FINALIZADO";
  }
  if (input.hasCheckIn) return "FALTA_CERRAR";
  if (balanceDue > 0.009) return "POR_LIQUIDAR";

  const endAt = new Date(input.endAt);
  if (!Number.isNaN(endAt.getTime()) && endAt < now) {
    return "SIN_RESOLVER";
  }

  return "EN_CURSO";
}

export function contractDisplayPhaseBadgeVariant(
  phase: ContractDisplayPhase,
): "success" | "warning" | "danger" | "info" | "outline" | "default" {
  switch (phase) {
    case "FINALIZADO":
      return "success";
    case "EN_CURSO":
      return "info";
    case "FALTA_CERRAR":
    case "SIN_RESOLVER":
      return "warning";
    case "POR_LIQUIDAR":
      return "danger";
    case "ANULADO":
      return "outline";
    default:
      return "default";
  }
}
