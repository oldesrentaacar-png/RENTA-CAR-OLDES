import { NextResponse } from "next/server";

import { getContractCloseActPdfData } from "@/app/dashboard/contratos/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import {
  CLOSE_ACT_PDF_VERSION,
} from "@/lib/pdf/close-act-pdf";
import { renderCloseActPdf } from "@/lib/pdf/render";

export async function serveCloseActPdfResponse(
  contractId: string,
): Promise<NextResponse> {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: { message: "Supabase no configurado." } },
      { status: 503 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: { message: "No autenticado." } },
      { status: 401 },
    );
  }

  const allowed = await hasPermission(user.id, "contracts.view");
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: { message: "Sin permiso." } },
      { status: 403 },
    );
  }

  const pdfData = await getContractCloseActPdfData(contractId);
  if (!pdfData) {
    return NextResponse.json(
      { success: false, error: { message: "No se pudo generar el acta de cierre." } },
      { status: 404 },
    );
  }

  try {
    const buffer = await renderCloseActPdf(pdfData);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="acta-cierre-${pdfData.receiptCode}-${CLOSE_ACT_PDF_VERSION}.pdf"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
        "X-PDF-Template-Version": CLOSE_ACT_PDF_VERSION,
      },
    });
  } catch (error) {
    console.error("[serveCloseActPdfResponse]", error);
    return NextResponse.json(
      { success: false, error: { message: "Error al generar el acta PDF." } },
      { status: 500 },
    );
  }
}
