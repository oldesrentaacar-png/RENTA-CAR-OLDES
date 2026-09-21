import { formatMoney, parseMoneyInput, toNumber, multiply } from "@/lib/money";

export type ExtraLineItem = {
  label: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
};

export type ExtraLineDraft = {
  key: string;
  label: string;
  quantity: string;
  unitPrice: string;
};

export function newExtraLineKey(): string {
  return `x-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function lineAmountFromDraft(line: ExtraLineDraft): number {
  const qty = Math.max(0, parseMoneyInput(line.quantity || "0"));
  const unit = Math.max(0, parseMoneyInput(line.unitPrice || "0"));
  return toNumber(multiply(qty, unit));
}

export function draftToExtraLineItem(line: ExtraLineDraft): ExtraLineItem | null {
  const label = line.label.trim().slice(0, 200);
  const quantity = Math.max(0, parseMoneyInput(line.quantity || "0"));
  const unitPrice = Math.max(0, parseMoneyInput(line.unitPrice || "0"));
  const amount = Math.round(quantity * unitPrice * 100) / 100;
  if (!label || amount <= 0 || quantity <= 0) return null;
  return { label, quantity, unitPrice, amount };
}

export function extraLineItemToDraft(line: ExtraLineItem): ExtraLineDraft {
  const quantity =
    line.quantity != null && line.quantity > 0
      ? line.quantity
      : line.unitPrice && line.unitPrice > 0
        ? Math.round((line.amount / line.unitPrice) * 100) / 100 || 1
        : 1;
  const unitPrice =
    line.unitPrice != null && line.unitPrice > 0
      ? line.unitPrice
      : quantity > 0
        ? Math.round((line.amount / quantity) * 100) / 100
        : line.amount;
  return {
    key: newExtraLineKey(),
    label: line.label,
    quantity: String(quantity),
    unitPrice: String(unitPrice),
  };
}

export function normalizeExtraLineItems(
  lines: Array<{
    label?: string | null;
    amount?: number | null;
    quantity?: number | null;
    unitPrice?: number | null;
    unit_price?: number | null;
  }> | null | undefined,
): ExtraLineItem[] {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((line) => {
      const label = String(line?.label ?? "").trim().slice(0, 200);
      const quantityRaw = Number(line?.quantity ?? 0);
      const unitPriceRaw = Number(
        line?.unitPrice ?? line?.unit_price ?? 0,
      );
      let amount = Math.round(Number(line?.amount ?? 0) * 100) / 100;
      let quantity = quantityRaw > 0 ? quantityRaw : undefined;
      let unitPrice = unitPriceRaw > 0 ? unitPriceRaw : undefined;
      if (quantity && unitPrice) {
        amount = Math.round(quantity * unitPrice * 100) / 100;
      } else if (amount > 0 && !quantity && !unitPrice) {
        quantity = 1;
        unitPrice = amount;
      }
      return { label, amount, quantity, unitPrice };
    })
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
    quantity?: number | null;
    unit_price?: number | null;
    item_type?: string | null;
  }> | null | undefined,
): ExtraLineItem[] {
  const out: ExtraLineItem[] = [];
  for (const item of items ?? []) {
    const type = String(item.item_type ?? "CUSTOM").toUpperCase();
    if (type === "VEHICLE" || type === "TAX" || type === "DISCOUNT") continue;
    const label = String(item.description ?? "").trim().slice(0, 200);
    const quantity = Math.max(0, Number(item.quantity ?? 0));
    const unitPrice = Math.max(0, Number(item.unit_price ?? 0));
    let amount = Math.round(Number(item.amount ?? 0) * 100) / 100;
    if (quantity > 0 && unitPrice >= 0) {
      amount = Math.round(quantity * unitPrice * 100) / 100;
    }
    if (!label || amount <= 0) continue;
    const lower = label.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    if (/\brenta\b/.test(lower) || /\balquiler\b/.test(lower)) continue;
    out.push({
      label,
      amount,
      quantity: quantity > 0 ? quantity : 1,
      unitPrice: unitPrice > 0 ? unitPrice : amount,
    });
  }
  return out.slice(0, 40);
}

/** Prefer named lines; if lump is higher, keep named + residual so totals match. */
export function reconcileNamedExtrasWithLump(input: {
  named?: Array<{
    label?: string | null;
    amount?: number | null;
    quantity?: number | null;
    unitPrice?: number | null;
  }> | null;
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
        quantity: 1,
        unitPrice: residual,
      },
    ].slice(0, 40);
  }
  return named;
}

/** Prefer named lines; fall back to a single lump if only a sum exists. */
export function resolveExtraLineItems(input: {
  named?: Array<{
    label?: string | null;
    amount?: number | null;
    quantity?: number | null;
    unitPrice?: number | null;
  }> | null;
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
        quantity: 1,
        unitPrice: lump,
      },
    ];
  }
  return [];
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
        const row = item as {
          label?: string;
          amount?: number | string;
          quantity?: number | string;
          unitPrice?: number | string;
          unit_price?: number | string;
        };
        return {
          label: row.label,
          amount: Number(row.amount ?? 0),
          quantity: Number(row.quantity ?? 0),
          unitPrice: Number(row.unitPrice ?? row.unit_price ?? 0),
        };
      }),
    );
  } catch {
    return [];
  }
}

export function formatExtraLineDetail(line: ExtraLineItem): string {
  const qty = line.quantity ?? 1;
  const unit = line.unitPrice ?? line.amount;
  if (qty > 1 || (line.unitPrice != null && line.unitPrice > 0)) {
    return `${qty} × ${formatMoney(unit)}`;
  }
  return formatMoney(line.amount);
}
