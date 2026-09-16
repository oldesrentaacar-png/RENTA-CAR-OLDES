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

/** Line-item quote totals (catalog / custom lines + % discount + % tax).
 * VEHICLE lines are always billed as dailyRate × rentalDays. */
export function calculateQuoteLineTotals(input: {
  startAt: Date | string;
  endAt: Date | string;
  lines: Array<{
    quantity: MoneyInput;
    unit_price: MoneyInput;
    amount?: MoneyInput;
    item_type?: string | null;
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
    const unit = parseMoneyInput(line.unit_price);
    const isVehicle = line.item_type === "VEHICLE";
    const qty = isVehicle
      ? rentalDays
      : parseMoneyInput(line.quantity);
    const amount =
      !isVehicle && line.amount !== undefined && line.amount !== ""
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

/** Normalize quote lines so VEHICLE rows always use rental days × daily rate. */
export function normalizeQuoteVehicleLines<
  T extends {
    quantity: number;
    unit_price: number;
    amount?: number;
    item_type?: string | null;
  },
>(lines: T[], startAt: Date | string, endAt: Date | string): T[] {
  const rentalDays = rentalDaysBetween(startAt, endAt);
  return lines.map((line) => {
    if (line.item_type !== "VEHICLE") return line;
    const unit = parseMoneyInput(line.unit_price);
    const quantity = rentalDays;
    return {
      ...line,
      quantity,
      amount: toNumber(multiply(quantity, unit)),
    };
  });
}

/** Reservation total = (tarifa × días) + extras. Depósito no se suma.
 * Seguro diario queda en 0 (va incluido en tarifa); extras cubren
 * silla, entrega fuera de horario, seguro internacional, etc. */
export function calculateReservationTotal(input: {
  startAt: Date | string;
  endAt: Date | string;
  agreedRate: MoneyInput;
  insurance?: MoneyInput;
  additionalCosts?: MoneyInput;
}): {
  rentalDays: number;
  rentalSubtotal: number;
  insurance: number;
  additionalCosts: number;
  total: number;
} {
  const rentalDays = rentalDaysBetween(input.startAt, input.endAt);
  const agreedRate = parseMoneyInput(input.agreedRate);
  const insurance = parseMoneyInput(input.insurance);
  const additionalCosts = parseMoneyInput(input.additionalCosts);
  const rentalSubtotal = toNumber(multiply(agreedRate, rentalDays));
  const total = toNumber(add(rentalSubtotal, add(insurance, additionalCosts)));
  return { rentalDays, rentalSubtotal, insurance, additionalCosts, total };
}

/** Build reservation pricing from an accepted quote so totals match. */
export function deriveReservationPricingFromQuote(input: {
  dailyRate: MoneyInput;
  rentalDays: number;
  quoteTotal: MoneyInput;
  lines?: Array<{
    description: string;
    quantity: MoneyInput;
    unit_price: MoneyInput;
    amount?: MoneyInput;
    item_type?: string | null;
  }>;
}): {
  agreedRate: number;
  rentalSubtotal: number;
  additionalCosts: number;
  total: number;
  extraLines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
} {
  const agreedRate = parseMoneyInput(input.dailyRate);
  const rentalDays = Math.max(0, Number(input.rentalDays) || 0);
  const quoteTotal = parseMoneyInput(input.quoteTotal);
  const rentalSubtotal = toNumber(multiply(agreedRate, rentalDays));

  const extraLines = (input.lines ?? [])
    .filter((line) => String(line.item_type ?? "").toUpperCase() !== "VEHICLE")
    .map((line) => {
      const unitPrice = parseMoneyInput(line.unit_price);
      const quantity = parseMoneyInput(line.quantity);
      const amount =
        line.amount !== undefined && line.amount !== ""
          ? parseMoneyInput(line.amount)
          : toNumber(multiply(quantity, unitPrice));
      return {
        description: String(line.description || "Extra").trim() || "Extra",
        quantity,
        unitPrice,
        amount,
      };
    });

  // Keep reservation total identical to quote total; extras absorb
  // non-rental lines plus tax/discount adjustments on the quote.
  const additionalCosts = Math.max(
    0,
    toNumber(subtract(quoteTotal, rentalSubtotal)),
  );

  return {
    agreedRate,
    rentalSubtotal,
    additionalCosts,
    total: toNumber(add(rentalSubtotal, additionalCosts)),
    extraLines,
  };
}
