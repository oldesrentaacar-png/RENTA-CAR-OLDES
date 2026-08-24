import { rentalDaysBetween } from "@/lib/dates";
import {
  add,
  multiply,
  parseMoneyInput,
  subtract,
  toNumber,
  type MoneyInput,
} from "@/lib/money";

export type QuoteCalculationInput = {
  startAt: Date | string;
  endAt: Date | string;
  dailyRate: MoneyInput;
  insuranceAmount?: MoneyInput;
  depositAmount?: MoneyInput;
  deliveryFee?: MoneyInput;
  pickupFee?: MoneyInput;
  discountAmount?: MoneyInput;
  otherCharges?: MoneyInput;
  taxRate?: MoneyInput;
};

export type QuoteCalculationResult = {
  rentalDays: number;
  subtotal: number;
  insuranceAmount: number;
  depositAmount: number;
  deliveryFee: number;
  pickupFee: number;
  discountAmount: number;
  otherCharges: number;
  taxableBase: number;
  taxAmount: number;
  total: number;
};

export function calculateQuoteTotals(
  input: QuoteCalculationInput,
): QuoteCalculationResult {
  const rentalDays = rentalDaysBetween(input.startAt, input.endAt);
  const dailyRate = parseMoneyInput(input.dailyRate);
  const subtotal = toNumber(multiply(dailyRate, rentalDays));

  const insuranceAmount = parseMoneyInput(input.insuranceAmount);
  const depositAmount = parseMoneyInput(input.depositAmount);
  const deliveryFee = parseMoneyInput(input.deliveryFee);
  const pickupFee = parseMoneyInput(input.pickupFee);
  const discountAmount = parseMoneyInput(input.discountAmount);
  const otherCharges = parseMoneyInput(input.otherCharges);
  const taxRate = parseMoneyInput(input.taxRate);

  const chargesBeforeTax = subtract(
    add(
      subtotal,
      add(insuranceAmount, add(deliveryFee, add(pickupFee, otherCharges))),
    ),
    discountAmount,
  );

  const taxableBase = Math.max(0, toNumber(chargesBeforeTax));
  const taxAmount =
    taxRate > 0 ? toNumber(multiply(taxableBase, taxRate / 100)) : 0;

  // Deposit is held separately and does NOT increase the rental total.
  const total = toNumber(add(taxableBase, taxAmount));

  return {
    rentalDays,
    subtotal,
    insuranceAmount,
    depositAmount,
    deliveryFee,
    pickupFee,
    discountAmount,
    otherCharges,
    taxableBase,
    taxAmount,
    total,
  };
}

/** Line-item quote totals (catalog / custom lines + % discount + % tax). */
export function calculateQuoteLineTotals(input: {
  startAt: Date | string;
  endAt: Date | string;
  lines: Array<{
    quantity: MoneyInput;
    unit_price: MoneyInput;
    amount?: MoneyInput;
  }>;
  discountPercent?: MoneyInput;
  taxRatePercent?: MoneyInput;
  depositAmount?: MoneyInput;
}): QuoteCalculationResult & { discountPercent: number } {
  const rentalDays = rentalDaysBetween(input.startAt, input.endAt);
  const discountPercent = parseMoneyInput(input.discountPercent);
  const taxRatePercent = parseMoneyInput(input.taxRatePercent);
  const depositAmount = parseMoneyInput(input.depositAmount);

  let subtotal = 0;
  for (const line of input.lines) {
    const qty = parseMoneyInput(line.quantity);
    const unit = parseMoneyInput(line.unit_price);
    const amount =
      line.amount !== undefined && line.amount !== ""
        ? parseMoneyInput(line.amount)
        : toNumber(multiply(qty, unit));
    subtotal = toNumber(add(subtotal, amount));
  }

  const discountAmount =
    discountPercent > 0
      ? toNumber(multiply(subtotal, discountPercent / 100))
      : 0;
  const taxableBase = Math.max(0, toNumber(subtract(subtotal, discountAmount)));
  const taxAmount =
    taxRatePercent > 0
      ? toNumber(multiply(taxableBase, taxRatePercent / 100))
      : 0;
  const total = toNumber(add(taxableBase, taxAmount));

  return {
    rentalDays,
    subtotal,
    insuranceAmount: 0,
    depositAmount,
    deliveryFee: 0,
    pickupFee: 0,
    discountAmount,
    otherCharges: 0,
    taxableBase,
    taxAmount,
    total,
    discountPercent,
  };
}

/** Reservation total = (tarifa × días) + seguro. Depósito no se suma. */
export function calculateReservationTotal(input: {
  startAt: Date | string;
  endAt: Date | string;
  agreedRate: MoneyInput;
  insurance?: MoneyInput;
}): {
  rentalDays: number;
  rentalSubtotal: number;
  insurance: number;
  total: number;
} {
  const rentalDays = rentalDaysBetween(input.startAt, input.endAt);
  const agreedRate = parseMoneyInput(input.agreedRate);
  const insurance = parseMoneyInput(input.insurance);
  const rentalSubtotal = toNumber(multiply(agreedRate, rentalDays));
  const total = toNumber(add(rentalSubtotal, insurance));
  return { rentalDays, rentalSubtotal, insurance, total };
}
