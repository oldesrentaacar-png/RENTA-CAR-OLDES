import { NextResponse } from "next/server";

import { CONTRACT_PDF_TEMPLATE_VERSION } from "@/lib/pdf/contract-pdf-meta";

/** Public build marker — use to confirm Vercel deployed the latest PDF template. */
export async function GET() {
  return NextResponse.json(
    {
      pdfTemplateVersion: CONTRACT_PDF_TEMPLATE_VERSION,
      contractPdfLayout: "single-top-panel-v3",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    },
  );
}
