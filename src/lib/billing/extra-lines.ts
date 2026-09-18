import { isExcludedQuoteBillingLine } from "@/lib/pdf/contract-billing";

export type ExtraLineItem = { label: string; amount: number };

export function normalizeExtraLineItems(
  lines: Array<{ label?: string | null; amount?: number | null }> | null | undefined,
): ExtraLineItem[] {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((line) => ({
      label: String(line?.label ?? "").trim().slice(0, 200),
      amount: Math.round(Number(line?.amount ?? 0) * 100) / 100,
    }))
    .filter((line) => line.label.length > 0 && line.amount > 0)
    .slice(0, 40);
}

export function sumExtraLineItems(lines: ExtraLineItem[]): number {
  return Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
}

/** Non-vehicle quote rows → named extras for reservation/contract. */
export function extraLinesFromQuoteItems(
  items: Array<{
    description?: string | null;
    amount?: number | null;
    item_type?: string | null;
  }> | null | undefined,
): ExtraLineItem[] {
  const out: ExtraLineItem[] = [];
  for (const item of items ?? []) {
    const label = String(item.description ?? "").trim().slice(0, 200);
    const amount = Math.round(Number(item.amount ?? 0) * 100) / 100;
    if (!label || amount <= 0) continue;
    if (isExcludedQuoteBillingLine(label, item.item_type)) continue;
    out.push({ label, amount });
  }
  return out.slice(0, 40);
}

/** Prefer named lines; fall back to a single lump if only a sum exists. */
export function resolveExtraLineItems(input: {
  named?: Array<{ label?: string | null; amount?: number | null }> | null;
  lumpAmount?: number | null;
  lumpLabel?: string;
}): ExtraLineItem[] {
  const named = normalizeExtraLineItems(input.named);
  if (named.length > 0) return named;
  const lump = Math.round(Number(input.lumpAmount ?? 0) * 100) / 100;
  if (lump > 0) {
    return [
      {
        label: input.lumpLabel?.trim() || "Costos adicionales",
        amount: lump,
      },
    ];
  }
  return [];
}

/** Prefer named lines; if lump is higher, keep named + residual so totals match. */
export function reconcileNamedExtrasWithLump(input: {
  named?: Array<{ label?: string | null; amount?: number | null }> | null;
  lumpAmount?: number | null;
  residualLabel?: string;
  lumpLabel?: string;
}): ExtraLineItem[] {
  const named = normalizeExtraLineItems(input.named);
  const lump = Math.round(Number(input.lumpAmount ?? 0) * 100) / 100;
  if (named.length === 0) {
    return resolveExtraLineItems({
      lumpAmount: lump,
      lumpLabel: input.lumpLabel || input.residualLabel,
    });
  }
  const namedSum = sumExtraLineItems(named);
  const residual = Math.round((lump - namedSum) * 100) / 100;
  if (residual > 0.009) {
    return [
      ...named,
      {
        label:
          (input.residualLabel || "Ajuste / otros de cotización").slice(0, 200),
        amount: residual,
      },
    ].slice(0, 40);
  }
  return named;
}

export function parseExtraLineItemsFromForm(
  raw: FormDataEntryValue | null,
): ExtraLineItem[] | undefined {
  if (raw == null || raw === "") return undefined;
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    if (!Array.isArray(parsed)) return [];
    return normalizeExtraLineItems(
      parsed.map((item) => {
        const row = item as { label?: string; amount?: number | string };
        return {
          label: row.label,
          amount: Number(row.amount ?? 0),
        };
      }),
    );
  } catch {
    return [];
  }
}
