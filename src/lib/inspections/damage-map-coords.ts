import type { DamageView } from "@/types/database";

/** Procedural pickup (Hilux-style) bounds for the 3D viewer. */
export const CAR_DIMENSIONS = {
  width: 1.9,
  length: 5.2,
  bodyHeight: 1.05,
  roofHeight: 0.38,
  groundClearance: 0.38,
  /** Portion of length that is the open bed (rear). */
  bedLengthRatio: 0.38,
} as const;

export function getCarTotalHeight(): number {
  return (
    CAR_DIMENSIONS.groundClearance +
    CAR_DIMENSIONS.bodyHeight +
    CAR_DIMENSIONS.roofHeight
  );
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function markToWorldPosition(mark: {
  view: DamageView;
  x: number;
  y: number;
}): [number, number, number] {
  const { width, length, bodyHeight, roofHeight, groundClearance } =
    CAR_DIMENSIONS;
  const sideHeight = bodyHeight;
  const topY = groundClearance + bodyHeight + roofHeight - 0.03;
  const sideBase = groundClearance + 0.02;

  switch (mark.view) {
    case "TOP":
      return [
        mark.x * width - width / 2,
        topY,
        mark.y * length - length / 2,
      ];
    case "FRONT":
      return [
        mark.x * width - width / 2,
        sideBase + mark.y * sideHeight,
        length / 2 + 0.02,
      ];
    case "REAR":
      return [
        mark.x * width - width / 2,
        sideBase + mark.y * sideHeight,
        -length / 2 - 0.02,
      ];
    case "LEFT":
      return [
        -width / 2 - 0.02,
        sideBase + mark.y * sideHeight,
        (1 - mark.x) * length - length / 2,
      ];
    case "RIGHT":
      return [
        width / 2 + 0.02,
        sideBase + mark.y * sideHeight,
        mark.x * length - length / 2,
      ];
    default:
      return [0, topY, 0];
  }
}

export function worldPointToMark(
  x: number,
  y: number,
  z: number,
  normalX: number,
  normalY: number,
  normalZ: number,
): { view: DamageView; x: number; y: number } {
  const { width, length, bodyHeight, groundClearance } = CAR_DIMENSIONS;
  const sideHeight = bodyHeight;
  const absX = Math.abs(normalX);
  const absY = Math.abs(normalY);
  const absZ = Math.abs(normalZ);

  if (absY >= absX && absY >= absZ) {
    return {
      view: "TOP",
      x: clamp01((x + width / 2) / width),
      y: clamp01((z + length / 2) / length),
    };
  }

  if (absZ >= absX) {
    return {
      view: normalZ > 0 ? "FRONT" : "REAR",
      x: clamp01((x + width / 2) / width),
      y: clamp01((y - groundClearance) / sideHeight),
    };
  }

  return {
    view: normalX < 0 ? "LEFT" : "RIGHT",
    x: clamp01(
      normalX < 0
        ? 1 - (z + length / 2) / length
        : (z + length / 2) / length,
    ),
    y: clamp01((y - groundClearance) / sideHeight),
  };
}
