/**
 * Operational display phase for contracts list (aligned with calendar language).
 * DB status (CLIENT_SIGNED, etc.) stays for signature workflow.
 */
export type ContractDisplayPhase =
  | "FINALIZADO"
  | "EN_CURSO"
  | "ANULADO"
  | "SIN_RESOLVER";

export const CONTRACT_DISPLAY_PHASE_LABELS: Record<
  ContractDisplayPhase,
  string
> = {
  FINALIZADO: "Finalizado",
  EN_CURSO: "En curso",
  ANULADO: "Anulado",
  SIN_RESOLVER: "Sin resolver",
};

export const CONTRACT_DISPLAY_PHASE_OPTIONS: Array<{
  value: ContractDisplayPhase;
  label: string;
}> = [
  { value: "EN_CURSO", label: "En curso" },
  { value: "SIN_RESOLVER", label: "Sin resolver" },
  { value: "FINALIZADO", label: "Finalizado" },
  { value: "ANULADO", label: "Anulado" },
];

export function deriveContractDisplayPhase(input: {
  status: string;
  closedAt?: string | null;
  endAt: string;
  now?: Date;
}): ContractDisplayPhase {
  const status = String(input.status ?? "").toUpperCase();
  const now = input.now ?? new Date();

  if (status === "CANCELLED") return "ANULADO";
  if (status === "COMPLETED" || input.closedAt) return "FINALIZADO";

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
    case "SIN_RESOLVER":
      return "warning";
    case "ANULADO":
      return "outline";
    default:
      return "default";
  }
}
