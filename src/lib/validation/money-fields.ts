import { z } from "zod";

import { parseMoneyInput, parseRateInput } from "@/lib/money";

/** Montos en USD (abonos, totales, depósitos): 2 decimales. */
export const moneyField = z.preprocess(
  (value) => parseMoneyInput(value),
  z
    .number()
    .min(0, "El monto no puede ser negativo.")
    .max(999_999_999.99, "Monto demasiado alto."),
);

/** Tarifa diaria: hasta 6 decimales para cuadrar días × tarifa = total pactado. */
export const rateField = z.preprocess(
  (value) => parseRateInput(value),
  z
    .number()
    .min(0, "La tarifa no puede ser negativa.")
    .max(999_999.999999, "Tarifa demasiado alta."),
);
