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

export type WireframeDamageMark = {
  x: number;
  y: number;
  symbol: string;
  phase?: "OUT" | "IN";
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Bake damage marks into the wireframe PNG using the same normalized
 * coordinates as the inspection UI (x/y in 0–1 over the full image).
 * Avoids react-pdf absolute-position drift from objectFit/letterboxing.
 */
export async function compositeDamageMarksOnWireframe(
  wireframeDataUrl: string,
  marks: WireframeDamageMark[],
): Promise<string> {
  const usable = marks.filter(
    (mark) =>
      Number.isFinite(mark.x) &&
      Number.isFinite(mark.y) &&
      mark.x >= 0 &&
      mark.x <= 1 &&
      mark.y >= 0 &&
      mark.y <= 1,
  );
  if (usable.length === 0) return wireframeDataUrl;

  const base64 = wireframeDataUrl.replace(/^data:image\/\w+;base64,/, "");
  const input = Buffer.from(base64, "base64");
  const image = sharp(input);
  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 8 || height < 8) return wireframeDataUrl;

  const radius = Math.max(16, Math.round(Math.min(width, height) * 0.016));
  const diameter = radius * 2;

  const overlays = await Promise.all(
    usable.map(async (mark) => {
      const cx = Math.round(mark.x * width);
      const cy = Math.round(mark.y * height);
      const fill = mark.phase === "IN" ? "#b91c1c" : "#0f2747";
      const fontSize = Math.round(radius * 1.15);
      const symbol = escapeXml((mark.symbol || "?").slice(0, 2));

      const svg = Buffer.from(
        `<svg width="${diameter}" height="${diameter}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${radius}" cy="${radius}" r="${radius - 1.5}" fill="${fill}" stroke="#ffffff" stroke-width="2.5"/>
  <text x="${radius}" y="${radius + fontSize * 0.35}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="#ffffff">${symbol}</text>
</svg>`,
      );

      const left = Math.max(0, Math.min(width - diameter, cx - radius));
      const top = Math.max(0, Math.min(height - diameter, cy - radius));

      return {
        input: await sharp(svg).png().toBuffer(),
        left,
        top,
      };
    }),
  );

  const out = await sharp(input).composite(overlays).png().toBuffer();
  return `data:image/png;base64,${out.toString("base64")}`;
}

export async function prepareContractPdfImages<
  T extends {
    operatorSignatureUrl?: string | null;
    annexPhotos?: Array<{ url: string; label: string }>;
    vehicleType?: string | null;
    vehicleTypeSlug?: string | null;
    vehicleTypeName?: string | null;
    vehicleModel?: string | null;
    damageMarks?: WireframeDamageMark[];
  },
>(data: T): Promise<T & { inspectionWireframeUrl?: string | null }> {
  const wireframeType = resolveInspectionWireframe({
    category: data.vehicleType,
    model: data.vehicleModel,
    typeSlug: data.vehicleTypeSlug,
    typeName: data.vehicleTypeName,
  });

  const [operatorSignatureUrl, annexPhotos, baseWireframe] = await Promise.all([
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

  let inspectionWireframeUrl = baseWireframe;
  if (baseWireframe && (data.damageMarks?.length ?? 0) > 0) {
    const outMarks = (data.damageMarks ?? []).filter((m) => m.phase !== "IN");
    const marksForDiagram =
      outMarks.length > 0 ? outMarks : (data.damageMarks ?? []);
    inspectionWireframeUrl = await compositeDamageMarksOnWireframe(
      baseWireframe,
      marksForDiagram,
    );
  }

  return {
    ...data,
    operatorSignatureUrl,
    annexPhotos,
    inspectionWireframeUrl,
  };
}
