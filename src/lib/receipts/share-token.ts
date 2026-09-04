import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

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
    throw new Error("No hay secreto configurado para firmar enlaces de recibo.");
  }
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Build a long-lived signed token so clients can open the receipt PDF without login. */
export function createReceiptPdfShareToken(
  receiptId: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${receiptId}.${exp}`;
  const sig = signPayload(payload);
  return `${exp}.${sig}`;
}

export function verifyReceiptPdfShareToken(
  receiptId: string,
  token: string | null | undefined,
): boolean {
  if (!token || !shareSecret()) return false;
  const [expRaw, sig] = token.split(".");
  if (!expRaw || !sig) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expected = signPayload(`${receiptId}.${exp}`);
  return safeEqual(sig, expected);
}

export function resolveAppBaseUrl(requestUrl?: string | null): string | null {
  const configured = env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;

  const vercel = trimOptional(process.env.VERCEL_URL);
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  if (requestUrl) {
    try {
      const url = new URL(requestUrl);
      return url.origin;
    } catch {
      return null;
    }
  }

  return null;
}

function trimOptional(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  return value.trim();
}

export function buildReceiptPdfShareUrl(
  receiptId: string,
  baseUrl?: string | null,
): string | null {
  const origin = (baseUrl ?? resolveAppBaseUrl())?.replace(/\/$/, "");
  if (!origin || !shareSecret()) return null;
  const token = createReceiptPdfShareToken(receiptId);
  return `${origin}/api/receipts/${receiptId}/pdf?token=${encodeURIComponent(token)}`;
}
