import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  INSPECTION_WIREFRAME_LABELS,
  resolveInspectionWireframe,
  type InspectionWireframeType,
} from "@/lib/inspections/inspection-wireframe-public";

const WIREFRAME_FILES: Record<InspectionWireframeType, string> = {
  SEDAN: "sedan.png",
  PICKUP: "pickup.png",
  MINIVAN: "minivan.png",
  SUV: "suv.png",
};

async function loadWireframePng(
  type: InspectionWireframeType,
): Promise<Buffer> {
  const filePath = path.join(
    process.cwd(),
    "public",
    "pdf",
    "inspection-wireframes",
    WIREFRAME_FILES[type],
  );
  return readFile(filePath);
}

export type GeneratedVehicleAssets = {
  /** Mismo PNG de 5 vistas que el mapa de daños (sedán / pickup / …). */
  wireframeDiagram: Buffer;
  wireframeType: InspectionWireframeType;
  wireframeLabel: string;
};

/**
 * Devuelve el diagrama 2D de inspección (5 vistas) del tipo de carro.
 * Es el mismo archivo que usa el «Mapa de daños» — no siluetas SVG.
 */
export async function generateVehicleAssetsFromPhoto(input: {
  category?: string | null;
  model?: string | null;
  typeSlug?: string | null;
  typeName?: string | null;
  /** Override manual si la detección automática falla. */
  wireframeType?: InspectionWireframeType | null;
}): Promise<GeneratedVehicleAssets> {
  const wireframeType =
    input.wireframeType ??
    resolveInspectionWireframe({
      category: input.category,
      model: input.model,
      typeSlug: input.typeSlug,
      typeName: input.typeName,
    });

  const wireframeDiagram = await loadWireframePng(wireframeType);

  return {
    wireframeDiagram,
    wireframeType,
    wireframeLabel: INSPECTION_WIREFRAME_LABELS[wireframeType],
  };
}
