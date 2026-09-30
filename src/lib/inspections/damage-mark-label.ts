import {
  DAMAGE_SEVERITY_LABELS,
  DAMAGE_TYPE_LABELS,
} from "@/lib/inspections/defaults";

type DamageMarkLabelInput = {
  markNumber?: number | null;
  symbol?: string | null;
  damageType?: string | null;
  severity?: string | null;
  description?: string | null;
  pathPoints?: Array<{ x: number; y: number }> | null;
};

/** True when the mark is freehand (trazo libre) — must never show a number. */
export function isFreehandDamageMark(
  mark: Pick<DamageMarkLabelInput, "pathPoints">,
): boolean {
  return Boolean(mark.pathPoints && mark.pathPoints.length >= 2);
}

/**
 * Human-readable damage note for UI/PDF/close act.
 * Freehand marks stay unnumbered (client requirement).
 */
export function formatDamageMarkLabel(mark: DamageMarkLabelInput): string {
  const note = mark.description?.trim();
  if (isFreehandDamageMark(mark)) {
    return note ? `Trazo libre — ${note}` : "Trazo libre";
  }

  const typeLabel =
    DAMAGE_TYPE_LABELS[mark.damageType ?? ""] ?? mark.damageType ?? "Daño";
  const severityLabel =
    DAMAGE_SEVERITY_LABELS[mark.severity ?? "LOW"] ??
    mark.severity ??
    "Leve";
  const symbol = mark.symbol?.trim() ? `${mark.symbol} ` : "";
  return `${symbol}${typeLabel} · ${severityLabel}${note ? ` — ${note}` : ""}`;
}
