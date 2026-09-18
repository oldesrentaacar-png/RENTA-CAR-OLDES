import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
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

/** Prefer production APP_URL; never send localhost links to clients. */
export function resolvePublicShareOrigin(
  preferred?: string | null,
): string | null {
  const configured = resolveAppBaseUrl()?.replace(/\/$/, "") ?? null;
  const candidate = preferred?.replace(/\/$/, "") ?? null;

  const usable = (origin: string | null): string | null => {
    if (!origin) return null;
    try {
      const host = new URL(origin).hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
        return null;
      }
      return origin;
    } catch {
      return null;
    }
  };

  return usable(configured) ?? usable(candidate) ?? configured ?? candidate;
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

/**
 * Short WhatsApp-friendly PDF URL:
 *   https://dominio.com/c/COT-XXXX?k=<token>
 */
export function buildQuotePdfShareUrl(
  quoteId: string,
  quoteCode: string,
  baseUrl?: string | null,
): string | null {
  const origin = resolvePublicShareOrigin(baseUrl);
  if (!origin || !shareSecret()) return null;
  const code = String(quoteCode ?? "").trim();
  if (!code) return null;
  const token = createQuotePdfShareToken(quoteId);
  return `${origin}/c/${encodeURIComponent(code)}?k=${encodeURIComponent(token)}`;
}
