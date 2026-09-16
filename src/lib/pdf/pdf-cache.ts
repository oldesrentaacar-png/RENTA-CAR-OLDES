/** Shared anti-cache headers so edited documents never show a stale PDF. */
export const PDF_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
} as const;

/** Bump when quote PDF layout or billing logic changes. */
export const QUOTE_PDF_TEMPLATE_VERSION = "2026-09-16-v2";

export function quotePdfHref(
  quoteId: string,
  updatedAt?: string | null,
): string {
  const params = new URLSearchParams({
    v: QUOTE_PDF_TEMPLATE_VERSION,
  });
  if (updatedAt) {
    params.set("t", String(new Date(updatedAt).getTime()));
  } else {
    params.set("t", String(Date.now()));
  }
  return `/api/quotes/${quoteId}/pdf?${params.toString()}`;
}

/** Bump when receipt PDF layout changes. */
export const RECEIPT_PDF_TEMPLATE_VERSION = "2026-09-16-v2";

export function receiptPdfHref(
  receiptId: string,
  updatedAt?: string | null,
): string {
  const params = new URLSearchParams({
    v: RECEIPT_PDF_TEMPLATE_VERSION,
  });
  if (updatedAt) {
    params.set("t", String(new Date(updatedAt).getTime()));
  } else {
    params.set("t", String(Date.now()));
  }
  return `/api/receipts/${receiptId}/pdf?${params.toString()}`;
}

/** Bump when close-act PDF layout changes (keep in sync with CLOSE_ACT_PDF_VERSION). */
export const CLOSE_ACT_PDF_TEMPLATE_VERSION = "2026-09-16-v2";

export function closeActPdfHref(
  contractId: string,
  updatedAt?: string | null,
): string {
  const params = new URLSearchParams({
    v: CLOSE_ACT_PDF_TEMPLATE_VERSION,
  });
  if (updatedAt) {
    params.set("t", String(new Date(updatedAt).getTime()));
  } else {
    params.set("t", String(Date.now()));
  }
  return `/dashboard/contratos/${contractId}/acta-cierre/pdf?${params.toString()}`;
}
