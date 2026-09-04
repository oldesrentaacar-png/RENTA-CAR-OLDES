/** Client-safe wireframe helpers (no Node fs). */

export type InspectionWireframeType = "SEDAN" | "PICKUP" | "MINIVAN" | "SUV";

const WIREFRAME_FILES: Record<InspectionWireframeType, string> = {
  SEDAN: "sedan.png",
  PICKUP: "pickup.png",
  MINIVAN: "minivan.png",
  SUV: "suv.png",
};

export const INSPECTION_WIREFRAME_LABELS: Record<
  InspectionWireframeType,
  string
> = {
  SEDAN: "Sedán",
  PICKUP: "Pick Up",
  MINIVAN: "Mini Van",
  SUV: "Camioneta (SUV)",
};

export function resolveInspectionWireframe(input?: {
  category?: string | null;
  model?: string | null;
  typeSlug?: string | null;
  typeName?: string | null;
}): InspectionWireframeType {
  const slug = (input?.typeSlug ?? "").toLowerCase().trim();

  if (slug === "pickup") return "PICKUP";
  if (slug === "sedan") return "SEDAN";
  if (slug === "minivan") return "MINIVAN";
  if (slug.startsWith("suv") || slug.includes("camioneta")) return "SUV";

  const hay =
    `${input?.typeName ?? ""} ${input?.category ?? ""} ${input?.model ?? ""}`.toLowerCase();

  if (
    hay.includes("pickup") ||
    hay.includes("pick-up") ||
    hay.includes("pick up") ||
    hay.includes("hilux") ||
    hay.includes("ranger") ||
    hay.includes("l200") ||
    hay.includes("np300") ||
    hay.includes("palangana") ||
    hay.includes("mighty") ||
    hay.includes("frontier")
  ) {
    return "PICKUP";
  }

  if (
    hay.includes("minivan") ||
    hay.includes("mini van") ||
    hay.includes("van") ||
    hay.includes("caravan") ||
    hay.includes("odyssey") ||
    hay.includes("sienna")
  ) {
    return "MINIVAN";
  }

  if (
    hay.includes("suv") ||
    hay.includes("camioneta") ||
    hay.includes("crossover") ||
    hay.includes("jeep") ||
    hay.includes("rogue") ||
    hay.includes("pathfinder") ||
    hay.includes("outlander") ||
    hay.includes("compass") ||
    hay.includes("4x4") ||
    hay.includes("4 x 4") ||
    hay.includes("filas")
  ) {
    return "SUV";
  }

  return "SEDAN";
}

/** Public URL for the 5-view wireframe PNG used in UI + PDF. */
export function inspectionWireframePublicPath(
  type: InspectionWireframeType,
): string {
  return `/pdf/inspection-wireframes/${WIREFRAME_FILES[type]}`;
}
