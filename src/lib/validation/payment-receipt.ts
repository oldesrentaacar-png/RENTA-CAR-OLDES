import { z } from "zod";

import { optionalText, optionalUuid } from "@/lib/validation/form-helpers";

const moneyField = z.coerce
  .number()
  .min(0, "El monto no puede ser negativo.")
  .max(999_999_999.99, "Monto demasiado alto.");

export const paymentReceiptSchema = z.object({
  customerId: optionalUuid(),
  contractId: optionalUuid(),
  reservationId: optionalUuid(),
  amount: moneyField.refine(
    (value) => value > 0,
    "El monto debe ser mayor a cero.",
  ),
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER"]).default("CASH"),
  concept: z
    .string()
    .trim()
    .min(1, "Concepto requerido.")
    .max(200)
    .default("Abono"),
  notes: optionalText(1000),
  /** When true (default), also creates a linked income_transactions row. */
  createIncome: z
    .union([z.boolean(), z.string(), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === null || value === "") return true;
      if (typeof value === "boolean") return value;
      return value === "true" || value === "1" || value === "on";
    }),
  incomeType: z.enum(["RENTAL", "DEPOSIT"]).default("RENTAL"),
  receiptKind: z.enum(["PAYMENT", "REFUND"]).default("PAYMENT"),
});

export const paymentRefundSchema = paymentReceiptSchema.extend({
  receiptKind: z.literal("REFUND"),
});

export type PaymentReceiptInput = z.infer<typeof paymentReceiptSchema>;
export type PaymentRefundInput = z.infer<typeof paymentRefundSchema>;

export const paymentReceiptSearchSchema = z.object({
  contractId: z.uuid().optional(),
  customerId: z.uuid().optional(),
  receiptKind: z.enum(["PAYMENT", "REFUND"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaymentReceiptSearchInput = z.infer<
  typeof paymentReceiptSearchSchema
>;
