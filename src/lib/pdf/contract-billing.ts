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
  /** Manual extras added on the contract (always shown). */
  manualLines?: Array<{ label?: string | null; amount?: number | null }>;
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

  const manual: ContractBillingLine[] = [];
  for (const item of input.manualLines ?? []) {
    const label = String(item.label ?? "").trim();
    const amount = money(Number(item.amount ?? 0));
    if (!label || amount <= 0) continue;
    manual.push({ label, amount });
  }

  const quoteExtrasSum = money(
    candidates.reduce((sum, line) => toNumber(add(sum, line.amount)), 0),
  );
  const manualSum = money(
    manual.reduce((sum, line) => toNumber(add(sum, line.amount)), 0),
  );

  // Preferred pretax when we trust line parts: rental + insurance + quote + manual.
  const partsPretax = money(
    toNumber(add(add(base, quoteExtrasSum), manualSum)),
  );

  let extraLines: ContractBillingLine[] = [...candidates, ...manual];
  let pretaxTotal = partsPretax;

  if (applyIva) {
    const storedTax = money(Math.max(0, Number(input.taxAmount) || 0));
    if (storedTax > 0 && contractTotal > storedTax) {
      pretaxTotal = money(toNumber(subtract(contractTotal, storedTax)));
    } else if (taxRate > 0 && !almostEqual(partsPretax * (1 + taxRate), contractTotal)) {
      // Prefer explicit parts if they nearly match inclusive total.
      const implied = money(contractTotal / (1 + taxRate));
      if (almostEqual(partsPretax, implied) || partsPretax > 0) {
        pretaxTotal = partsPretax;
      } else {
        pretaxTotal = implied;
      }
    } else {
      pretaxTotal = partsPretax;
    }
  } else if (almostEqual(partsPretax, contractTotal) || manual.length > 0 || candidates.length > 0) {
    pretaxTotal = partsPretax;
    // If contract total differs and no manual/quote lines, keep legacy adjustment path.
    if (
      candidates.length === 0 &&
      manual.length === 0 &&
      !almostEqual(base, contractTotal)
    ) {
      if (contractTotal > base + MONEY_EPS) {
        extraLines = [
          {
            label: "Otros cargos acordados",
            amount: money(toNumber(subtract(contractTotal, base))),
          },
        ];
        pretaxTotal = contractTotal;
      } else {
        extraLines = [];
        pretaxTotal = contractTotal;
      }
    }
  } else if (almostEqual(base, contractTotal)) {
    extraLines = [...manual];
    pretaxTotal = money(toNumber(add(base, manualSum)));
  } else if (contractTotal > base + MONEY_EPS) {
    extraLines = [
      ...manual,
      {
        label: "Otros cargos acordados",
        amount: money(toNumber(subtract(contractTotal, base + manualSum))),
      },
    ].filter((l) => l.amount > 0);
    pretaxTotal = contractTotal;
  } else {
    extraLines = [...manual];
    pretaxTotal = contractTotal;
  }

  const taxAmount = applyIva
    ? money(
        Number(input.taxAmount) > 0
          ? Number(input.taxAmount)
          : Math.max(0, toNumber(subtract(contractTotal, pretaxTotal))),
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
