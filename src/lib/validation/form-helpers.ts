import { z } from "zod";

/** FormData.get() returns null for empty fields — normalize before Zod. */
export function emptyToUndefined(value: unknown) {
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}

export function optionalText(max: number) {
  return z.preprocess(
    emptyToUndefined,
    z.string().trim().max(max).optional(),
  );
}

export function optionalUuid() {
  return z.preprocess(
    emptyToUndefined,
    z.string().uuid().optional(),
  );
}

export function formatZodIssues(error: z.ZodError): string {
  const message = error.issues
    .map((issue) => issue.message)
    .filter(Boolean)
    .join(" ");
  return message || "Datos inválidos.";
}

/** Supabase joins may return an object or a one-element array. */
export function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
