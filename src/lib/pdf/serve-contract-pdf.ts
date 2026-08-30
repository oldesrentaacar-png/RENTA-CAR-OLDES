import { NextResponse } from "next/server";

import { getContractPdfData } from "@/app/dashboard/contratos/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { CONTRACT_PDF_TEMPLATE_VERSION } from "@/lib/pdf/contract-pdf-meta";
import { renderContractPdf } from "@/lib/pdf/render";

export async function serveContractPdfResponse(
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

  const pdfData = await getContractPdfData(contractId);
  if (!pdfData) {
    return NextResponse.json(
      { success: false, error: { message: "Contrato no encontrado." } },
      { status: 404 },
    );
  }

  try {
    const buffer = await renderContractPdf(pdfData);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="contrato-${pdfData.contractCode}-${CONTRACT_PDF_TEMPLATE_VERSION}.pdf"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
        "X-PDF-Template-Version": CONTRACT_PDF_TEMPLATE_VERSION,
      },
    });
  } catch (error) {
    console.error("[serveContractPdfResponse]", error);
    return NextResponse.json(
      { success: false, error: { message: "Error al generar PDF." } },
      { status: 500 },
    );
  }
}
