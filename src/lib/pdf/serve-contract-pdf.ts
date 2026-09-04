import { NextResponse } from "next/server";

import { getContractPdfData } from "@/app/dashboard/contratos/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { CONTRACT_PDF_TEMPLATE_VERSION } from "@/lib/pdf/contract-pdf-meta";
import { prepareContractPdfImages } from "@/lib/pdf/pdf-images";
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

  const supabase = await createClient();
  const { data: clientSig } = await supabase
    .from("contract_signatures")
    .select("id")
    .eq("contract_id", contractId)
    .eq("signer_type", "CLIENT")
    .maybeSingle();

  if (!clientSig) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            "El contrato aún no tiene firma electrónica del cliente. Complete la firma antes de ver o compartir el PDF.",
        },
      },
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
    const ready = await prepareContractPdfImages(pdfData);
    const buffer = await renderContractPdf(ready);
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
