/** Helpers seguros para cliente y servidor (sin sharp / Node). */

export function isGeneratedVehicleImage(publicId: string): boolean {
  return (
    publicId.includes("/generated/") ||
    publicId.includes("iso-sheet-") ||
    publicId.includes("view-")
  );
}
