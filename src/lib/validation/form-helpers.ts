import { z } from "zod";

/** Query/FormData may send arrays for repeated keys — take the first. */
export function firstParam(value: unknown): unknown {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** FormData/query empty fields → undefined before Zod enums/uuids. */
export function emptyToUndefined(value: unknown) {
  const normalized = firstParam(value);
  if (normalized === "" || normalized === null || normalized === undefined) {
    return undefined;
  }
  return normalized;
}

export function optionalText(max: number) {
  return z.preprocess(
    emptyToUndefined,
    z.string().trim().max(max).optional(),
  );
}

/**
 * Optional form text. FormData.get() returns null when the field is missing;
 * Zod 4 then answers "Invalid input". Null and "" become undefined.
 * A whitespace-only value also becomes undefined, same as the previous helpers.
 */
export function blankText(max: number) {
  return z.preprocess(
    (value) => (value == null ? undefined : value),
    z
      .string()
      .trim()
      .max(max)
      .optional()
      .or(z.literal(""))
      .transform((value) => (value === "" ? undefined : value)),
  );
}

export function optionalUuid() {
  return z.preprocess(emptyToUndefined, z.string().uuid().optional());
}

/** Optional enum that accepts "" / null from "Todos" filters. */
export function optionalEnum<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(emptyToUndefined, schema.optional());
}

export function optionalDateYmd() {
  return z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
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
