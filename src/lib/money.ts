import Decimal from "decimal.js";

Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

export type MoneyInput = string | number | Decimal;

export function toDecimal(value: MoneyInput): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value);
}

export function add(a: MoneyInput, b: MoneyInput): Decimal {
  return toDecimal(a).plus(toDecimal(b));
}

export function subtract(a: MoneyInput, b: MoneyInput): Decimal {
  return toDecimal(a).minus(toDecimal(b));
}

export function multiply(a: MoneyInput, b: MoneyInput): Decimal {
  return toDecimal(a).times(toDecimal(b));
}

export function divide(a: MoneyInput, b: MoneyInput): Decimal {
  return toDecimal(a).dividedBy(toDecimal(b));
}

export function sum(values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>(
    (total, value) => total.plus(toDecimal(value)),
    new Decimal(0),
  );
}

export function formatMoney(
  value: MoneyInput,
  currency: string = "USD",
  locale: string = "es-SV",
): string {
  const amount = toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount.toNumber());
}

/** Converts a monetary value to a number suitable for PostgreSQL NUMERIC columns. */
export function toNumber(value: MoneyInput): number {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Safe parse for form money fields. Empty / invalid → 0.
 * Never returns negative or NaN.
 */
export function parseMoneyInput(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") {
    return toNumber(fallback);
  }
  try {
    const amount = toDecimal(String(value).replace(",", "."));
    if (!amount.isFinite() || amount.isNaN()) {
      return toNumber(fallback);
    }
    if (amount.isNegative()) {
      return 0;
    }
    return toNumber(amount);
  } catch {
    return toNumber(fallback);
  }
}

export function isPositive(value: MoneyInput): boolean {
  return toDecimal(value).greaterThan(0);
}

export function isZeroOrPositive(value: MoneyInput): boolean {
  return toDecimal(value).greaterThanOrEqualTo(0);
}
