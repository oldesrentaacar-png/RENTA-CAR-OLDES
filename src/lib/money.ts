import Decimal from "decimal.js";

Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

export type MoneyInput = string | number | Decimal;

/** Decimales para montos (USD): abonos, totales, depósitos. */
export const MONEY_DECIMALS = 2;
/** Decimales para tarifas diarias: permite 435/7 = 62.142857… */
export const RATE_DECIMALS = 6;

export function toDecimal(value: MoneyInput | null | undefined): Decimal {
  if (value instanceof Decimal) {
    return value.isFinite() ? value : new Decimal(0);
  }
  if (value == null || value === "") {
    return new Decimal(0);
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    return new Decimal(0);
  }
  try {
    const amount = new Decimal(value);
    return amount.isFinite() ? amount : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
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
  value: MoneyInput | null | undefined,
  currency: string = "USD",
  locale: string = "es-SV",
): string {
  try {
    const amount = toDecimal(value).toDecimalPlaces(MONEY_DECIMALS, Decimal.ROUND_HALF_UP);
    const n = amount.toNumber();
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(n) ? n : 0);
  } catch {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0);
  }
}

/** Converts a monetary value to a number suitable for PostgreSQL NUMERIC columns. */
export function toNumber(value: MoneyInput | null | undefined): number {
  const n = toDecimal(value)
    .toDecimalPlaces(MONEY_DECIMALS, Decimal.ROUND_HALF_UP)
    .toNumber();
  return Number.isFinite(n) ? n : 0;
}

/** Tarifa diaria con hasta 6 decimales (no redondear a centavos). */
export function toRateNumber(value: MoneyInput | null | undefined): number {
  const n = toDecimal(value)
    .toDecimalPlaces(RATE_DECIMALS, Decimal.ROUND_HALF_UP)
    .toNumber();
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse de tarifa diaria. Conserva hasta 6 decimales para que
 * días × tarifa llegue al total pactado (ej. 7 × 62.142857 = 435.00).
 */
export function parseRateInput(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") {
    return toRateNumber(fallback);
  }
  try {
    const amount = toDecimal(String(value).replace(",", "."));
    if (!amount.isFinite() || amount.isNaN()) {
      return toRateNumber(fallback);
    }
    if (amount.isNegative()) {
      return 0;
    }
    return toRateNumber(amount);
  } catch {
    return toRateNumber(fallback);
  }
}

/** Muestra tarifa con hasta 6 decimales (sin ceros basura al final). */
export function formatRate(
  value: MoneyInput | null | undefined,
  locale: string = "es-SV",
): string {
  try {
    const amount = toDecimal(value).toDecimalPlaces(
      RATE_DECIMALS,
      Decimal.ROUND_HALF_UP,
    );
    const n = amount.toNumber();
    if (!Number.isFinite(n)) return "$0";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: RATE_DECIMALS,
    }).format(n);
  } catch {
    return "$0.00";
  }
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
