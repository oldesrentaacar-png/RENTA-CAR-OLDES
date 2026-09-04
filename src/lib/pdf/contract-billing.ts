import { add, subtract, toNumber } from "@/lib/money";

export type ContractBillingLine = {
  label: string;
  amount: number;
};

export type ContractBillingBreakdown = {
  rentalSubtotal: number;
  insurance: number;
  extraLines: ContractBillingLine[];
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
 * Build a billing breakdown that ALWAYS reconciles to `contractTotal`.
 * Never invents a total from quote lines alone.
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
}): ContractBillingBreakdown {
  const rentalDays = Math.max(0, Number(input.rentalDays) || 0);
  const dailyRate = money(Number(input.dailyRate) || 0);
  const insurance = money(Math.max(0, Number(input.insurance) || 0));
  const contractTotal = money(Math.max(0, Number(input.contractTotal) || 0));
  const rentalSubtotal = money(dailyRate * rentalDays);
  const base = money(toNumber(add(rentalSubtotal, insurance)));

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

  // Happy path: base + quote extras == contracted total.
  if (
    candidates.length > 0 &&
    almostEqual(toNumber(add(base, extrasSum)), contractTotal)
  ) {
    return {
      rentalSubtotal,
      insurance,
      extraLines: candidates,
      total: contractTotal,
    };
  }

  // Contract matches base rental + insurance — ignore stray quote lines.
  if (almostEqual(base, contractTotal)) {
    return {
      rentalSubtotal,
      insurance,
      extraLines: [],
      total: contractTotal,
    };
  }

  // Contracted total is higher than base: one transparent adjustment line.
  if (contractTotal > base + MONEY_EPS) {
    const adjustment = money(toNumber(subtract(contractTotal, base)));
    return {
      rentalSubtotal,
      insurance,
      extraLines: [
        {
          label: "Otros cargos acordados",
          amount: adjustment,
        },
      ],
      total: contractTotal,
    };
  }

  // Contracted total below base (data anomaly): still show fields, never invent.
  return {
    rentalSubtotal,
    insurance,
    extraLines: [],
    total: contractTotal,
  };
}
