/** Safe numeric coercion for DB → RSC → client (never returns NaN). */

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function asOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Sum values with finite coercion (NaN/null → 0). */
export function sumAsNumber(
  values: unknown[],
  pick?: (item: unknown) => unknown,
): number {
  return values.reduce<number>((total, item) => {
    const raw = pick ? pick(item) : item;
    return total + asNumber(raw, 0);
  }, 0);
}
