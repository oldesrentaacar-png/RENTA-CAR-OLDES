import { env } from "@/lib/env";

export type OriginValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/$/, "");
}

export function getAllowedOrigins(): string[] {
  const configured = env.LANDING_ALLOWED_ORIGIN;
  if (!configured) {
    return [];
  }

  return configured
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

export function validateOrigin(origin: string | null): OriginValidationResult {
  const allowedOrigins = getAllowedOrigins();

  if (allowedOrigins.length === 0) {
    return {
      valid: false,
      reason: "LANDING_ALLOWED_ORIGIN no está configurado.",
    };
  }

  if (!origin) {
    return {
      valid: false,
      reason: "Encabezado Origin ausente.",
    };
  }

  const normalizedOrigin = normalizeOrigin(origin);
  const isAllowed = allowedOrigins.some(
    (allowed) => allowed === normalizedOrigin,
  );

  if (!isAllowed) {
    return {
      valid: false,
      reason: "Origen no autorizado.",
    };
  }

  return { valid: true };
}

export function validateRequestOrigin(
  headers: Headers,
): OriginValidationResult {
  return validateOrigin(headers.get("origin"));
}

export function buildCorsHeaders(origin: string | null): HeadersInit {
  const validation = validateOrigin(origin);
  if (!validation.valid || !origin) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": normalizeOrigin(origin),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Origin",
    Vary: "Origin",
  };
}
