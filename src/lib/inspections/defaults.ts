import type { ChecklistItemStatus } from "@/types/database";
import { OLDES_ACCESSORIES } from "@/lib/contracts/oldes-terms";

export type DefaultChecklistItem = {
  itemKey: string;
  label: string;
  status: ChecklistItemStatus;
};

/**
 * Checklist de accesorios alineado al contrato físico OLDES.
 * Prefer `getDefaultChecklistFromCatalog()` when creating inspections so the
 * DB `accessory_catalog` is used when available.
 */
export const DEFAULT_CHECKLIST_ITEMS: DefaultChecklistItem[] =
  OLDES_ACCESSORIES.map((item) => ({
    itemKey: item.key,
    label: item.label,
    status: "OK" as const,
  }));

export const FUEL_LEVEL_LABELS: Record<string, string> = {
  EMPTY: "Vacío (E)",
  ONE_EIGHTH: "1/8",
  QUARTER: "1/4",
  THREE_EIGHTHS: "3/8",
  HALF: "1/2",
  FIVE_EIGHTHS: "5/8",
  THREE_QUARTERS: "3/4",
  SEVEN_EIGHTHS: "7/8",
  FULL: "Lleno (F)",
};

/** Orden visual del tanque (embudo), no porcentaje. */
export const FUEL_LEVEL_ORDER = [
  "EMPTY",
  "ONE_EIGHTH",
  "QUARTER",
  "THREE_EIGHTHS",
  "HALF",
  "FIVE_EIGHTHS",
  "THREE_QUARTERS",
  "SEVEN_EIGHTHS",
  "FULL",
] as const;

export const FUEL_GAUGE_MARKS = [
  "E",
  "1/8",
  "1/4",
  "3/8",
  "1/2",
  "5/8",
  "3/4",
  "7/8",
  "F",
] as const;

export const DAMAGE_TYPE_LABELS: Record<string, string> = {
  SCRATCH: "Rayón",
  DENT: "Abolladura",
  CRACK: "Grieta",
  PAINT: "Pintura",
  BROKEN: "Roto",
  OTHER: "Otro",
};

export const DAMAGE_SEVERITY_LABELS: Record<string, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
};

export const INSPECTION_TYPE_LABELS: Record<string, string> = {
  CHECK_OUT: "Salida",
  CHECK_IN: "Entrada",
};

export const CHECKLIST_STATUS_LABELS: Record<string, string> = {
  OK: "Está",
  DAMAGED: "Averiado",
  MISSING: "No está",
  NOT_APPLICABLE: "N/A",
};

export const PHOTO_CATEGORY_LABELS: Record<string, string> = {
  FRONT: "Frontal",
  REAR: "Trasera",
  LEFT: "Izquierda",
  RIGHT: "Derecha",
  INTERIOR: "Interior",
  DASHBOARD: "Tablero",
  WHEELS: "Ruedas",
  DAMAGE: "Daño",
  OTHER: "Otro",
};

export function percentToFuelLevel(percent: number): string {
  if (percent <= 6) return "EMPTY";
  if (percent <= 18) return "ONE_EIGHTH";
  if (percent <= 31) return "QUARTER";
  if (percent <= 43) return "THREE_EIGHTHS";
  if (percent <= 56) return "HALF";
  if (percent <= 68) return "FIVE_EIGHTHS";
  if (percent <= 81) return "THREE_QUARTERS";
  if (percent <= 93) return "SEVEN_EIGHTHS";
  return "FULL";
}
