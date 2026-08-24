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
  .union([z.uuid(), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value === "" || value == null ? undefined : value));

export const quoteLineSchema = z.object({
  description: z.string().trim().min(1, "Descripción requerida.").max(500),
  quantity: z.coerce.number().positive("Cantidad inválida."),
  unit_price: moneyField,
  amount: moneyField.optional(),
  item_type: z
    .enum(["VEHICLE", "SERVICE", "TAX", "DISCOUNT", "CUSTOM"])
    .default("CUSTOM"),
  catalog_item_id: z.uuid().optional().nullable(),
  item_code: z.string().trim().max(50).optional().nullable(),
  /** Fraction 0–1 as stored on catalog / quote_items */
  tax_rate: z.coerce.number().min(0).max(1).optional(),
});

export const quoteFields = z.object({
  customerId: z.uuid("Cliente inválido."),
  vehicleId: optionalUuid,
  webRequestId: z.uuid().optional(),
  startAt: z.iso.datetime({ message: "Fecha de inicio inválida." }),
  endAt: z.iso.datetime({ message: "Fecha de fin inválida." }),
  dailyRate: moneyField.default(0),
  insuranceAmount: moneyField.default(0),
  depositAmount: moneyField.default(0),
  deliveryFee: moneyField.default(0),
  pickupFee: moneyField.default(0),
  discountAmount: moneyField.default(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  otherCharges: moneyField.default(0),
  /** Percent 0–100 in the form / calculation helpers */
  taxRate: z.coerce.number().min(0).max(100).default(0),
  language: z.enum(["es", "en"]).default("en"),
  notes: optionalText(2000),
  terms: optionalText(10000),
  validUntil: z.iso.datetime().optional(),
  status: z
    .enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"])
    .default("DRAFT"),
  lines: z.array(quoteLineSchema).optional(),
});

export const quoteSchema = quoteFields
  .refine((data) => new Date(data.endAt) > new Date(data.startAt), {
    message: "La fecha de fin debe ser posterior a la de inicio.",
    path: ["endAt"],
  })
  .refine(
    (data) =>
      (data.lines && data.lines.length > 0) || data.dailyRate > 0,
    {
      message: "Agregue al menos una línea o una tarifa diaria.",
      path: ["lines"],
    },
  );

export const quoteUpdateSchema = quoteFields.partial();

export const quoteStatusSchema = z.object({
  status: z.enum([
    "DRAFT",
    "SENT",
    "ACCEPTED",
    "REJECTED",
    "EXPIRED",
    "CANCELLED",
  ]),
});

export type QuoteInput = z.infer<typeof quoteSchema>;
export type QuoteLineInput = z.infer<typeof quoteLineSchema>;
export type QuoteUpdateInput = z.infer<typeof quoteUpdateSchema>;

export const quoteSearchSchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: quoteStatusSchema.shape.status.optional(),
  customerId: z.uuid().optional(),
  vehicleId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type QuoteSearchInput = z.infer<typeof quoteSearchSchema>;
