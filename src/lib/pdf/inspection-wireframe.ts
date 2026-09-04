import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  inspectionWireframePublicPath,
  resolveInspectionWireframe,
  type InspectionWireframeType,
} from "@/lib/inspections/inspection-wireframe-public";

export type { InspectionWireframeType };
export { resolveInspectionWireframe, inspectionWireframePublicPath };

const cache = new Map<InspectionWireframeType, string>();

const WIREFRAME_FILES: Record<InspectionWireframeType, string> = {
  SEDAN: "sedan.png",
  PICKUP: "pickup.png",
  MINIVAN: "minivan.png",
  SUV: "suv.png",
};

async function pngDataUrl(buffer: Buffer): Promise<string> {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

export async function getInspectionWireframeDataUrl(
  type: InspectionWireframeType,
): Promise<string | null> {
  const cached = cache.get(type);
  if (cached) return cached;

  const baseDir = path.join(
    process.cwd(),
    "public",
    "pdf",
    "inspection-wireframes",
  );

  try {
    const buffer = await readFile(path.join(baseDir, WIREFRAME_FILES[type]));
    const dataUrl = await pngDataUrl(buffer);
    cache.set(type, dataUrl);
    return dataUrl;
  } catch (error) {
    console.error("[getInspectionWireframeDataUrl]", type, error);
    return null;
  }
}
