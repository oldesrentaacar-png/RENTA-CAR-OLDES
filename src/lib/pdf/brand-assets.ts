import { readFile } from "node:fs/promises";
import path from "node:path";

import { BRAND } from "@/lib/brand";

let cachedLogoDataUrl: string | null | undefined;

/**
 * Loads the OLDES logo as a data URL for @react-pdf/renderer.
 * Falls back to null if the file is missing (PDF still renders without image).
 */
export async function getBrandLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl !== undefined) {
    return cachedLogoDataUrl;
  }

    try {
    const logoPath = path.join(process.cwd(), "public", "brand", "oldes-logo.svg");
    const buffer = await readFile(logoPath);
    cachedLogoDataUrl = `data:image/svg+xml;base64,${buffer.toString("base64")}`;
    return cachedLogoDataUrl;
  } catch {
    try {
      const logoPath = path.join(process.cwd(), "public", "brand", "oldes-logo.png");
      const buffer = await readFile(logoPath);
      cachedLogoDataUrl = `data:image/png;base64,${buffer.toString("base64")}`;
      return cachedLogoDataUrl;
    } catch {
      cachedLogoDataUrl = null;
      return null;
    }
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
