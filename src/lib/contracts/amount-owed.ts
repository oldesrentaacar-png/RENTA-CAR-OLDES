import { toNumber } from "@/lib/money";

export type CourtesyCoverageInput = {
  agreedRate: number;
  rentalDays: number;
  insurance?: number;
  extraLinesTotal?: number;
  discountAmount?: number;
  /** Pretax total stored on the contract. Null when the column is absent. */
  subtotal?: number | null;
  total: number;
  taxAmount?: number;
  applyIva?: boolean;
  courtesyAmount?: number;
};

/**
 * Courtesy saved on the contract but not already subtracted from `total`.
 * A discount typed when the contract is created is inside `subtotal`/`total`.
 * A manual discount typed at return is stored in `courtesy_amount` and must
 * still reduce the balance when a later payment is recorded.
 */
export function unappliedCourtesyAmount(input: CourtesyCoverageInput): number {
  const pretaxBeforeCourtesy = Math.max(
    0,
    toNumber(
      Number(input.agreedRate) * Number(input.rentalDays) +
        Number(input.insurance ?? 0) +
        Number(input.extraLinesTotal ?? 0) -
        Number(input.discountAmount ?? 0),
    ),
  );
  const storedPretax =
    input.subtotal != null && Number.isFinite(Number(input.subtotal))
      ? Number(input.subtotal)
      : input.applyIva
        ? toNumber(Number(input.total) - Number(input.taxAmount ?? 0))
        : Number(input.total);
  const alreadyInside = Math.max(
    0,
    toNumber(pretaxBeforeCourtesy - storedPretax),
  );
  return Math.max(
    0,
    toNumber(Number(input.courtesyAmount ?? 0) - alreadyInside),
  );
}

export function owedAfterCourtesy(input: {
  total: number;
  charges: number;
  dayAdjustment?: number;
  unappliedCourtesy: number;
}): number {
  return Math.max(
    0,
    toNumber(
      Number(input.total) +
        Number(input.charges) +
        Number(input.dayAdjustment ?? 0) -
        Number(input.unappliedCourtesy),
    ),
  );
}

export function balanceAfterPayment(owed: number, paid: number): number {
  return Math.max(0, toNumber(Number(owed) - Number(paid)));
}

/**
 * Column default for balance_due is 0, which looks like "paid" on a new
 * contract that still has no receipts. If nothing was paid, the owed amount
 * is the contract total.
 */
export function displayBalanceDue(input: {
  total: number;
  amountPaid?: number | null;
  balanceDue?: number | null;
}): number {
  const paid = toNumber(input.amountPaid ?? 0);
  const stored = toNumber(input.balanceDue ?? 0);
  if (Math.abs(stored) > 0.009) return stored;
  if (paid > 0.009) return 0;
  return Math.max(0, toNumber(Number(input.total ?? 0) - paid));
}
