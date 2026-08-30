/** Bump when the contract PDF layout changes (forces fresh downloads). */
export const CONTRACT_PDF_TEMPLATE_VERSION = "2026-08-30-v2";

export function contractPdfHref(contractId: string): string {
  return `/api/contracts/${contractId}/pdf?v=${encodeURIComponent(CONTRACT_PDF_TEMPLATE_VERSION)}`;
}
