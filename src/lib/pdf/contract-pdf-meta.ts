/** Bump when the contract PDF layout changes (forces fresh downloads). */
export const CONTRACT_PDF_TEMPLATE_VERSION = "2026-09-02-v8";

export function contractPdfHref(contractId: string): string {
  return `/dashboard/contratos/${contractId}/pdf?v=${encodeURIComponent(CONTRACT_PDF_TEMPLATE_VERSION)}`;
}
