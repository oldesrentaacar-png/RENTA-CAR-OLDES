import { asNumber } from "@/lib/safe-number";

export type SettlementParts = {
  billedAmount: number;
  providerCost: number;
  oldesCost: number;
  commission: number;
  taxAmount: number;
  extraCosts: number;
};

export type SettlementMonthBalance = {
  billedAmount: number;
  providerCost: number;
  otherSettlementCosts: number;
  settlementProfit: number;
};

function cents(value: number): number {
  return Math.round(asNumber(value, 0) * 100);
}

function fromCents(value: number): number {
  return value / 100;
}

/** Ganancia de una liquidación: facturado − proveedor − costos OLDES − comisión − impuesto − extras. */
export function settlementOwnProfit(row: SettlementParts): number {
  return fromCents(
    cents(row.billedAmount) -
      cents(row.providerCost) -
      cents(row.oldesCost) -
      cents(row.commission) -
      cents(row.taxAmount) -
      cents(row.extraCosts),
  );
}

/**
 * Las tres partes siempre suman lo facturado:
 * ganancia propia + costo proveedores + otros costos.
 */
export function summarizeSettlementParts(
  rows: SettlementParts[],
): SettlementMonthBalance {
  let billed = 0;
  let provider = 0;
  let other = 0;

  for (const row of rows) {
    billed += cents(row.billedAmount);
    provider += cents(row.providerCost);
    other +=
      cents(row.oldesCost) +
      cents(row.commission) +
      cents(row.taxAmount) +
      cents(row.extraCosts);
  }

  return {
    billedAmount: fromCents(billed),
    providerCost: fromCents(provider),
    otherSettlementCosts: fromCents(other),
    settlementProfit: fromCents(billed - provider - other),
  };
}

/** Ganancia de las liquidaciones menos gastos y mantenimiento del mismo periodo. */
export function netAfterOperatingCosts(
  settlementProfit: number,
  operatingExpenses: number,
): number {
  return fromCents(cents(settlementProfit) - cents(operatingExpenses));
}
