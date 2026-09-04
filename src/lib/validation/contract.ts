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

export const contractSchema = z.object({
  reservationId: z.uuid("Reserva inválida."),
  terms: optionalText(10000),
  clauses: optionalText(10000),
  notes: optionalText(2000),
  status: z
    .enum([
      "PENDING",
      "CLIENT_SIGNED",
      "REPRESENTATIVE_SIGNED",
      "COMPLETED",
      "CANCELLED",
    ])
    .default("PENDING"),
});

export const contractUpdateSchema = contractSchema
  .omit({ reservationId: true })
  .partial();

export const contractSignSchema = z.object({
  signerType: z.enum(["CLIENT", "REPRESENTATIVE", "PAGARE"]),
  signedBy: z.string().trim().min(1, "Nombre del firmante requerido.").max(200),
  signatureDataUrl: z
    .string()
    .min(1, "Firma requerida.")
    .regex(/^data:image\/(png|jpeg|webp);base64,/, "Formato de firma inválido."),
  acceptedTerms: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
});

export type ContractInput = z.infer<typeof contractSchema>;
export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>;
export type ContractSignInput = z.infer<typeof contractSignSchema>;

export const contractSearchSchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: contractSchema.shape.status.optional(),
  customerId: z.uuid().optional(),
  vehicleId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ContractSearchInput = z.infer<typeof contractSearchSchema>;

export const contractFinancialSnapshotSchema = z.object({
  dailyRate: moneyField,
  deposit: moneyField.default(0),
  insurance: moneyField.default(0),
  total: moneyField,
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
});

export type ContractFinancialSnapshot = z.infer<
  typeof contractFinancialSnapshotSchema
>;
