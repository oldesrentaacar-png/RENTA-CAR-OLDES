import { NextResponse } from "next/server";

import { getQuotePdfData } from "@/app/dashboard/cotizaciones/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import {
  PDF_NO_STORE_HEADERS,
  QUOTE_PDF_TEMPLATE_VERSION,
} from "@/lib/pdf/pdf-cache";
import { renderQuotePdf } from "@/lib/pdf/render";
import { verifyQuotePdfShareToken } from "@/lib/quotes/share-token";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: { message: "Supabase no configurado." } },
      { status: 503 },
    );
  }

  const token = new URL(request.url).searchParams.get("token");
  const hasShareToken = verifyQuotePdfShareToken(id, token);

  if (!hasShareToken) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "No autenticado." } },
        { status: 401 },
      );
    }

    const allowed = await hasPermission(user.id, "quotes.view");
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: { message: "Sin permiso." } },
        { status: 403 },
      );
    }
  }

  const pdfData = await getQuotePdfData(id, {
    publicAccess: hasShareToken,
  });
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
        "Content-Disposition": `inline; filename="cotizacion-${pdfData.quoteCode}-${QUOTE_PDF_TEMPLATE_VERSION}.pdf"`,
        ...(hasShareToken
          ? {
              "Cache-Control":
                "private, no-store, no-cache, must-revalidate, max-age=0",
              Pragma: "no-cache",
              Expires: "0",
            }
          : PDF_NO_STORE_HEADERS),
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
