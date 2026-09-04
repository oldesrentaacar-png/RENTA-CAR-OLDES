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
 * Prefers the official PNG badge; SVG is rasterized as fallback.
 */
export async function getBrandLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl !== undefined) {
    return cachedLogoDataUrl;
  }

  const brandDir = path.join(process.cwd(), "public", "brand");
  const pngPath = path.join(brandDir, "oldes-logo.png");
  const svgPath = path.join(brandDir, "oldes-logo.svg");

  try {
    const buffer = await sharp(await readFile(pngPath))
      .rotate()
      .resize({
        width: 480,
        height: 180,
        fit: "inside",
        withoutEnlargement: false,
      })
      .png()
      .toBuffer();
    cachedLogoDataUrl = await pngDataUrlFromBuffer(buffer);
    return cachedLogoDataUrl;
  } catch (error) {
    console.warn("[getBrandLogoDataUrl] PNG logo failed, trying SVG", error);
  }

  try {
    const pngBuffer = await sharp(await readFile(svgPath))
      .resize({ width: 480, height: 180, fit: "inside" })
      .png()
      .toBuffer();
    cachedLogoDataUrl = await pngDataUrlFromBuffer(pngBuffer);
    return cachedLogoDataUrl;
  } catch (error) {
    console.error("[getBrandLogoDataUrl] logo unavailable", error);
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
