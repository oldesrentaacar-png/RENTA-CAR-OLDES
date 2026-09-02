import sharp from "sharp";

import {
  getInspectionWireframeDataUrl,
  resolveInspectionWireframe,
} from "@/lib/pdf/inspection-wireframe";

/** Embed remote images as data URLs so react-pdf does not fail on fetch/font issues. */
export async function toPdfSafeImageDataUrl(
  source: string | null | undefined,
): Promise<string | null> {
  if (!source?.trim()) return null;
  const url = source.trim();
  if (url.startsWith("data:")) return url;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;

    const input = Buffer.from(await response.arrayBuffer());
    if (input.length === 0) return null;

    const pngBuffer = await sharp(input).rotate().png().toBuffer();
    return `data:image/png;base64,${pngBuffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function prepareContractPdfImages<
  T extends {
    operatorSignatureUrl?: string | null;
    annexPhotos?: Array<{ url: string; label: string }>;
    vehicleType?: string | null;
    vehicleTypeSlug?: string | null;
    vehicleTypeName?: string | null;
    vehicleModel?: string | null;
  },
>(data: T): Promise<T & { inspectionWireframeUrl?: string | null }> {
  const wireframeType = resolveInspectionWireframe({
    category: data.vehicleType,
    model: data.vehicleModel,
    typeSlug: data.vehicleTypeSlug,
    typeName: data.vehicleTypeName,
  });

  const [operatorSignatureUrl, annexPhotos, inspectionWireframeUrl] =
    await Promise.all([
      toPdfSafeImageDataUrl(data.operatorSignatureUrl),
      data.annexPhotos
        ? Promise.all(
            data.annexPhotos.map(async (photo) => {
              const embedded = await toPdfSafeImageDataUrl(photo.url);
              return embedded ? { ...photo, url: embedded } : null;
            }),
          ).then((items) =>
            items.filter((item): item is { url: string; label: string } =>
              Boolean(item),
            ),
          )
        : Promise.resolve(data.annexPhotos),
      getInspectionWireframeDataUrl(wireframeType),
    ]);

  return {
    ...data,
    operatorSignatureUrl,
    annexPhotos,
    inspectionWireframeUrl,
  };
}
