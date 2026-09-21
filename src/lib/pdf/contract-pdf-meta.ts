/** Bump when the contract PDF layout changes (forces fresh downloads). */
export const CONTRACT_PDF_TEMPLATE_VERSION = "2026-09-21-v1";

export function contractPdfHref(
  contractId: string,
  updatedAt?: string | null,
): string {
  const params = new URLSearchParams({
    v: CONTRACT_PDF_TEMPLATE_VERSION,
    t: updatedAt
      ? String(new Date(updatedAt).getTime())
      : String(Date.now()),
  });
  return `/dashboard/contratos/${contractId}/pdf?${params.toString()}`;
}
