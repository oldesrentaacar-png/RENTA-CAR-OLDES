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
  severity?: string;
  markNumber?: number;
  /** Normalized freehand stroke (0–1), same coords as UI. */
  pathPoints?: Array<{ x: number; y: number }>;
};

/** Draw mark glyphs as vectors (no system fonts — sharp/librsvg often skips text). */
function damageMarkSvg(
  symbol: string,
  diameter: number,
  fill: string,
): Buffer {
  const r = diameter / 2;
  const stroke = Math.max(2.2, diameter * 0.12);
  const pad = Math.max(4, diameter * 0.22);
  const normalized = (symbol || "0").trim().charAt(0);

  let glyph = "";
  if (normalized === "+") {
    const arm = Math.max(2.4, diameter * 0.14);
    glyph = `
      <rect x="${r - arm / 2}" y="${pad}" width="${arm}" height="${diameter - pad * 2}" rx="${arm / 3}" fill="#ffffff"/>
      <rect x="${pad}" y="${r - arm / 2}" width="${diameter - pad * 2}" height="${arm}" rx="${arm / 3}" fill="#ffffff"/>
    `;
  } else if (normalized === "x" || normalized === "X" || normalized === "×") {
    const len = diameter - pad * 2;
    glyph = `
      <g stroke="#ffffff" stroke-width="${stroke}" stroke-linecap="round">
        <line x1="${pad}" y1="${pad}" x2="${pad + len}" y2="${pad + len}"/>
        <line x1="${pad + len}" y1="${pad}" x2="${pad}" y2="${pad + len}"/>
      </g>
    `;
  } else if (normalized === "·" || normalized === "." || normalized === "•") {
    const dot = Math.max(3, diameter * 0.18);
    glyph = `<circle cx="${r}" cy="${r}" r="${dot}" fill="#ffffff"/>`;
  } else {
    // "0" / golpe — óvalo blanco como el dígito 0 del UI
    const rx = Math.max(3.5, r - pad);
    const ry = Math.max(4.5, r - pad * 0.72);
    glyph = `
      <ellipse cx="${r}" cy="${r}" rx="${rx}" ry="${ry}" fill="none" stroke="#ffffff" stroke-width="${stroke}"/>
    `;
  }

  return Buffer.from(
    `<svg width="${diameter}" height="${diameter}" viewBox="0 0 ${diameter} ${diameter}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${r}" cy="${r}" r="${r - 1.2}" fill="${fill}" stroke="#ffffff" stroke-width="${Math.max(2, diameter * 0.06)}"/>
  ${glyph}
</svg>`,
  );
}

/**
 * Bake damage marks into the wireframe PNG using the same normalized
 * coordinates as the inspection UI (x/y in 0–1 over the full image).
 * Avoids react-pdf absolute-position drift from objectFit/letterboxing.
 */
function markStrokeColor(mark: WireframeDamageMark): string {
  const bySeverity =
    mark.severity === "HIGH"
      ? "#b91c1c"
      : mark.severity === "MEDIUM"
        ? "#c2410c"
        : mark.severity === "LOW"
          ? "#15803d"
          : null;
  return bySeverity ?? (mark.phase === "IN" ? "#b91c1c" : "#0f2747");
}

function freehandStrokeSvg(
  points: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  stroke: string,
): Buffer | null {
  const usable = points.filter(
    (p) =>
      Number.isFinite(p.x) &&
      Number.isFinite(p.y) &&
      p.x >= 0 &&
      p.x <= 1 &&
      p.y >= 0 &&
      p.y <= 1,
  );
  if (usable.length < 2) return null;

  const strokeWidth = Math.max(3, Math.round(Math.min(width, height) * 0.0045));
  const d = usable
    .map((p, i) => {
      const x = Math.round(p.x * width);
      const y = Math.round(p.y * height);
      return `${i === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");

  return Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>
</svg>`,
  );
}

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

  // Match UI marker scale (~28px on screen over ~1024px width).
  const diameter = Math.max(28, Math.round(Math.min(width, height) * 0.028));
  const radius = diameter / 2;

  const strokeOverlays = (
    await Promise.all(
      usable.map(async (mark) => {
        if (!mark.pathPoints || mark.pathPoints.length < 2) return null;
        const svg = freehandStrokeSvg(
          mark.pathPoints,
          width,
          height,
          markStrokeColor(mark),
        );
        if (!svg) return null;
        return {
          input: await sharp(svg).png().toBuffer(),
          left: 0,
          top: 0,
        };
      }),
    )
  ).filter((item): item is { input: Buffer; left: number; top: number } =>
    Boolean(item),
  );

  const pinOverlays = await Promise.all(
    usable.map(async (mark) => {
      const cx = Math.round(mark.x * width);
      const cy = Math.round(mark.y * height);
      const fill = markStrokeColor(mark);
      const svg = damageMarkSvg(mark.symbol || "0", diameter, fill);

      const left = Math.max(
        0,
        Math.min(width - diameter, Math.round(cx - radius)),
      );
      const top = Math.max(
        0,
        Math.min(height - diameter, Math.round(cy - radius)),
      );

      return {
        input: await sharp(svg).png().toBuffer(),
        left,
        top,
      };
    }),
  );

  const out = await sharp(input)
    .composite([...strokeOverlays, ...pinOverlays])
    .png()
    .toBuffer();
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
