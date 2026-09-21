/** Merge observation texts without duplicating the same paragraph. */
export function mergeObservationTexts(
  ...parts: Array<string | null | undefined>
): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const text = String(part ?? "").trim();
    if (!text) continue;
    const key = text.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out.join("\n\n");
}
