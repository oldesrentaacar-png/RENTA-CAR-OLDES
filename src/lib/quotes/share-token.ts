import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { QUOTE_PDF_TEMPLATE_VERSION } from "@/lib/pdf/pdf-cache";
import { resolveAppBaseUrl } from "@/lib/receipts/share-token";

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function shareSecret(): string | null {
  return (
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    null
  );
}

function signPayload(payload: string): string {
  const secret = shareSecret();
  if (!secret) {
    throw new Error(
      "No hay secreto configurado para firmar enlaces de cotización.",
    );
  }
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Signed token so the customer can open the quote PDF without login. */
export function createQuotePdfShareToken(
  quoteId: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `quote.${quoteId}.${exp}`;
  const sig = signPayload(payload);
  return `${exp}.${sig}`;
}

export function verifyQuotePdfShareToken(
  quoteId: string,
  token: string | null | undefined,
): boolean {
  if (!token || !shareSecret()) return false;
  const [expRaw, sig] = token.split(".");
  if (!expRaw || !sig) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expected = signPayload(`quote.${quoteId}.${exp}`);
  return safeEqual(sig, expected);
}

export function buildQuotePdfShareUrl(
  quoteId: string,
  baseUrl?: string | null,
): string | null {
  const origin = (baseUrl ?? resolveAppBaseUrl())?.replace(/\/$/, "");
  if (!origin || !shareSecret()) return null;
  const token = createQuotePdfShareToken(quoteId);
  const params = new URLSearchParams({
    token,
    v: QUOTE_PDF_TEMPLATE_VERSION,
    t: String(Date.now()),
  });
  return `${origin}/api/quotes/${quoteId}/pdf?${params.toString()}`;
}
