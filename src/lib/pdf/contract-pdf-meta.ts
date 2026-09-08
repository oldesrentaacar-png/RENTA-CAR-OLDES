/** Bump when the contract PDF layout changes (forces fresh downloads). */
export const CONTRACT_PDF_TEMPLATE_VERSION = "2026-09-04-v14";

export function contractPdfHref(
  contractId: string,
  updatedAt?: string | null,
): string {
  const params = new URLSearchParams({
    v: CONTRACT_PDF_TEMPLATE_VERSION,
  });
  if (updatedAt) {
    params.set("t", String(new Date(updatedAt).getTime()));
  }
  return `/dashboard/contratos/${contractId}/pdf?${params.toString()}`;
}
