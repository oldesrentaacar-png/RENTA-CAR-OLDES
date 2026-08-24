import { z } from "zod";

const moneyField = z.coerce
  .number()
  .min(0, "El monto no puede ser negativo.")
  .max(999_999_999.99, "Monto demasiado alto.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value));

const optionalUuid = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value === "" ? undefined : value))
  .pipe(z.uuid().optional());

export const depositStatusEnum = z.enum([
  "RECEIVED",
  "HELD",
  "RETURNED",
  "APPLIED",
  "PARTIALLY_APPLIED",
]);

export const incomeSchema = z
  .object({
    type: z.enum(["RENTAL", "DEPOSIT", "INSURANCE", "EXTRA", "OTHER"]),
    amount: moneyField.refine(
      (value) => value > 0,
      "El monto debe ser mayor a cero.",
    ),
    transactionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
    vehicleId: optionalUuid,
    reservationId: optionalUuid,
    contractId: optionalUuid,
    customerId: optionalUuid,
    paymentMethod: z
      .enum(["CASH", "TRANSFER", "CARD", "OTHER"])
      .default("CASH"),
    depositStatus: depositStatusEnum.optional(),
    reference: optionalText(100),
    notes: optionalText(1000),
  })
  .superRefine((data, ctx) => {
    if (data.type === "DEPOSIT" && !data.depositStatus) {
      ctx.addIssue({
        code: "custom",
        message: "Estado del depósito requerido.",
        path: ["depositStatus"],
      });
    }
    if (data.type !== "DEPOSIT" && data.depositStatus) {
      ctx.addIssue({
        code: "custom",
        message: "Solo los depósitos pueden tener estado.",
        path: ["depositStatus"],
      });
    }
  });

export const incomeUpdateSchema = z
  .object({
    type: z.enum(["RENTAL", "DEPOSIT", "INSURANCE", "EXTRA", "OTHER"]).optional(),
    amount: moneyField
      .refine((value) => value > 0, "El monto debe ser mayor a cero.")
      .optional(),
    transactionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.")
      .optional(),
    vehicleId: optionalUuid,
    reservationId: optionalUuid,
    contractId: optionalUuid,
    customerId: optionalUuid,
    paymentMethod: z.enum(["CASH", "TRANSFER", "CARD", "OTHER"]).optional(),
    depositStatus: depositStatusEnum.optional(),
    reference: optionalText(100),
    notes: optionalText(1000),
  })
  .superRefine((data, ctx) => {
    if (data.type === "DEPOSIT" && !data.depositStatus) {
      ctx.addIssue({
        code: "custom",
        message: "Estado del depósito requerido.",
        path: ["depositStatus"],
      });
    }
    if (data.type && data.type !== "DEPOSIT" && data.depositStatus) {
      ctx.addIssue({
        code: "custom",
        message: "Solo los depósitos pueden tener estado.",
        path: ["depositStatus"],
      });
    }
  });

export const expenseSchema = z.object({
  concept: z.string().trim().min(1, "Concepto requerido.").max(200),
  category: z.enum([
    "MAINTENANCE",
    "FUEL",
    "INSURANCE",
    "STAFF",
    "ADVERTISING",
    "WASH",
    "PARTS",
    "COMMISSIONS",
    "FINES",
    "OTHER",
  ]),
  amount: moneyField.refine(
    (value) => value > 0,
    "El monto debe ser mayor a cero.",
  ),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  vehicleId: optionalUuid,
  provider: optionalText(200),
  receiptPath: optionalText(500),
  notes: optionalText(1000),
});

export const expenseUpdateSchema = expenseSchema.partial();

export type IncomeInput = z.infer<typeof incomeSchema>;
export type IncomeUpdateInput = z.infer<typeof incomeUpdateSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;

export const financeSearchSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  vehicleId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type FinanceSearchInput = z.infer<typeof financeSearchSchema>;

export const profitabilitySearchSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  vehicleId: z.uuid().optional(),
});

export type ProfitabilitySearchInput = z.infer<
  typeof profitabilitySearchSchema
>;

export const reportFiltersSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  vehicleId: z.uuid().optional(),
  category: z.string().optional(),
});

export type ReportFiltersInput = z.infer<typeof reportFiltersSchema>;
