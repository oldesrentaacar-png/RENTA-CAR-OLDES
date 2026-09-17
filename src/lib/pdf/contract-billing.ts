import { add, subtract, toNumber } from "@/lib/money";

export type ContractBillingLine = {
  label: string;
  amount: number;
};

export type ContractBillingBreakdown = {
  rentalSubtotal: number;
  insurance: number;
  extraLines: ContractBillingLine[];
  /** Base before optional IVA. */
  pretaxTotal: number;
  applyIva: boolean;
  taxRate: number;
  taxAmount: number;
  /** Authoritative contracted total — always use this as MONTO TOTAL. */
  total: number;
};

const MONEY_EPS = 0.009;

function almostEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= MONEY_EPS;
}

function money(value: number): number {
  return toNumber(value);
}

/** Lines that duplicate the base “días × tarifa” (or are tax/discount). */
export function isExcludedQuoteBillingLine(
  label: string,
  itemType?: string | null,
): boolean {
  const type = String(itemType ?? "CUSTOM").toUpperCase();
  if (type === "VEHICLE" || type === "TAX" || type === "DISCOUNT") {
    return true;
  }

  const lower = label.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  // Any rental/lease wording is a vehicle-charge duplicate risk (e.g. "Renta de microbus").
  if (/\brenta\b/.test(lower) || /\balquiler\b/.test(lower)) {
    return true;
  }
  return false;
}

/**
 * Build a billing breakdown that ALWAYS reconciles to `contractTotal`
 * when IVA is off. When IVA is on, pretax is derived and tax is shown.
 */
export function buildContractBillingBreakdown(input: {
  rentalDays: number;
  dailyRate: number;
  insurance: number;
  contractTotal: number;
  quoteLines?: Array<{
    description?: string | null;
    amount?: number | null;
    item_type?: string | null;
  }>;
  applyIva?: boolean;
  taxRate?: number;
  taxAmount?: number;
}): ContractBillingBreakdown {
  const rentalDays = Math.max(0, Number(input.rentalDays) || 0);
  const dailyRate = money(Number(input.dailyRate) || 0);
  const insurance = money(Math.max(0, Number(input.insurance) || 0));
  const contractTotal = money(Math.max(0, Number(input.contractTotal) || 0));
  const rentalSubtotal = money(dailyRate * rentalDays);
  const base = money(toNumber(add(rentalSubtotal, insurance)));
  const applyIva = Boolean(input.applyIva);
  const taxRate = Math.max(0, Number(input.taxRate) || 0.13);

  const candidates: ContractBillingLine[] = [];
  for (const item of input.quoteLines ?? []) {
    const label = String(item.description ?? "").trim();
    const amount = money(Number(item.amount ?? 0));
    if (!label || amount <= 0) continue;
    if (isExcludedQuoteBillingLine(label, item.item_type)) continue;
    candidates.push({ label, amount });
  }

  const extrasSum = money(
    candidates.reduce((sum, line) => toNumber(add(sum, line.amount)), 0),
  );

  let extraLines: ContractBillingLine[] = [];
  let pretaxTotal = base;

  // Happy path: base + quote extras == contracted total (no IVA) or pretax.
  if (
    candidates.length > 0 &&
    almostEqual(toNumber(add(base, extrasSum)), contractTotal)
  ) {
    extraLines = candidates;
    pretaxTotal = money(toNumber(add(base, extrasSum)));
  } else if (almostEqual(base, contractTotal)) {
    extraLines = [];
    pretaxTotal = base;
  } else if (contractTotal > base + MONEY_EPS && !applyIva) {
    const adjustment = money(toNumber(subtract(contractTotal, base)));
    extraLines = [{ label: "Otros cargos acordados", amount: adjustment }];
    pretaxTotal = contractTotal;
  } else if (applyIva) {
    // Prefer stored tax; else reverse from inclusive total.
    const storedTax = money(Math.max(0, Number(input.taxAmount) || 0));
    if (storedTax > 0 && contractTotal > storedTax) {
      pretaxTotal = money(toNumber(subtract(contractTotal, storedTax)));
      if (candidates.length > 0) extraLines = candidates;
      else if (!almostEqual(base, pretaxTotal) && pretaxTotal > base + MONEY_EPS) {
        extraLines = [
          {
            label: "Otros cargos acordados",
            amount: money(toNumber(subtract(pretaxTotal, base))),
          },
        ];
      }
    } else if (taxRate > 0) {
      pretaxTotal = money(contractTotal / (1 + taxRate));
      if (candidates.length > 0) {
        extraLines = candidates;
        const fromParts = money(toNumber(add(base, extrasSum)));
        if (almostEqual(fromParts, pretaxTotal)) {
          pretaxTotal = fromParts;
        }
      } else if (!almostEqual(base, pretaxTotal) && pretaxTotal > base + MONEY_EPS) {
        extraLines = [
          {
            label: "Otros cargos acordados",
            amount: money(toNumber(subtract(pretaxTotal, base))),
          },
        ];
      }
    } else {
      pretaxTotal = contractTotal;
    }
  } else {
    // Contracted total below base (data anomaly): still show fields, never invent.
    extraLines = [];
    pretaxTotal = contractTotal;
  }

  const taxAmount = applyIva
    ? money(
        Number(input.taxAmount) > 0
          ? Number(input.taxAmount)
          : toNumber(subtract(contractTotal, pretaxTotal)),
      )
    : 0;

  return {
    rentalSubtotal,
    insurance,
    extraLines,
    pretaxTotal,
    applyIva,
    taxRate,
    taxAmount: Math.max(0, taxAmount),
    total: contractTotal,
  };
}

/** Compute pretax + tax + total when applying optional IVA. */
export function computeOptionalIvaTotals(input: {
  pretaxTotal: number;
  applyIva: boolean;
  taxRate?: number;
}): { pretaxTotal: number; taxAmount: number; total: number; taxRate: number } {
  const pretaxTotal = money(Math.max(0, Number(input.pretaxTotal) || 0));
  const taxRate = Math.max(0, Number(input.taxRate) || 0.13);
  if (!input.applyIva) {
    return { pretaxTotal, taxAmount: 0, total: pretaxTotal, taxRate };
  }
  const taxAmount = money(pretaxTotal * taxRate);
  return {
    pretaxTotal,
    taxAmount,
    total: money(toNumber(add(pretaxTotal, taxAmount))),
    taxRate,
  };
}
