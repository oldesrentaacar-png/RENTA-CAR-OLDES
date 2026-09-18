import { NextResponse } from "next/server";

import { getQuotePdfData } from "@/app/dashboard/cotizaciones/actions";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/env";
import {
  PDF_NO_STORE_HEADERS,
  QUOTE_PDF_TEMPLATE_VERSION,
} from "@/lib/pdf/pdf-cache";
import { renderQuotePdf } from "@/lib/pdf/render";
import { verifyQuotePdfShareToken } from "@/lib/quotes/share-token";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Short public quote PDF link for WhatsApp:
 *   /c/COT-XXXX?k=<token>
 * Looks cleaner than /api/quotes/{uuid}/pdf?token=...&v=...&t=...
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await context.params;
  const code = decodeURIComponent(rawCode ?? "").trim();
  const token = new URL(request.url).searchParams.get("k");

  if (!code || !token) {
    return NextResponse.json(
      { success: false, error: { message: "Enlace incompleto." } },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { success: false, error: { message: "Servicio no disponible." } },
      { status: 503 },
    );
  }

  const admin = createAdminClient();
  const { data: quote, error } = await admin
    .from("quotes")
    .select("id, code")
    .eq("code", code)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !quote) {
    return NextResponse.json(
      { success: false, error: { message: "Cotización no encontrada." } },
      { status: 404 },
    );
  }

  const quoteId = (quote as { id: string; code: string }).id;
  if (!verifyQuotePdfShareToken(quoteId, token)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            "Este enlace no es válido o expiró. Solicite uno nuevo a OLDES.",
        },
      },
      { status: 401 },
    );
  }

  const pdfData = await getQuotePdfData(quoteId, { publicAccess: true });
  if (!pdfData) {
    return NextResponse.json(
      { success: false, error: { message: "Cotización no encontrada." } },
      { status: 404 },
    );
  }

  try {
    const buffer = await renderQuotePdf(pdfData);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="cotizacion-${pdfData.quoteCode}.pdf"`,
        ...PDF_NO_STORE_HEADERS,
        "X-PDF-Template-Version": QUOTE_PDF_TEMPLATE_VERSION,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: "Error al generar PDF." } },
      { status: 500 },
    );
  }
}
