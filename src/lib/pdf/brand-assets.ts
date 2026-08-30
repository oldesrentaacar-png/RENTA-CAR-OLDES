import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { BRAND } from "@/lib/brand";

let cachedLogoDataUrl: string | null | undefined;

async function pngDataUrlFromBuffer(buffer: Buffer): Promise<string> {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

/**
 * Loads the OLDES logo as a PNG data URL for @react-pdf/renderer.
 * SVG sources are rasterized because react-pdf cannot render SVG text fonts.
 */
export async function getBrandLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl !== undefined) {
    return cachedLogoDataUrl;
  }

  const pngPath = path.join(process.cwd(), "public", "brand", "oldes-logo.png");
  const svgPath = path.join(process.cwd(), "public", "brand", "oldes-logo.svg");

  try {
    const buffer = await readFile(pngPath);
    cachedLogoDataUrl = await pngDataUrlFromBuffer(buffer);
    return cachedLogoDataUrl;
  } catch {
    // fall through
  }

  try {
    const svgBuffer = await readFile(svgPath);
    const pngBuffer = await sharp(svgBuffer).png().toBuffer();
    cachedLogoDataUrl = await pngDataUrlFromBuffer(pngBuffer);
    return cachedLogoDataUrl;
  } catch {
    cachedLogoDataUrl = null;
    return null;
  }
}

export const PDF_BRAND = {
  name: BRAND.fullName,
  navy: BRAND.colors.navy,
  navyDark: BRAND.colors.navyDark,
  red: BRAND.colors.red,
  cream: BRAND.colors.cream,
  muted: "#64748b",
  border: "#e2e8f0",
  text: "#0f172a",
} as const;
