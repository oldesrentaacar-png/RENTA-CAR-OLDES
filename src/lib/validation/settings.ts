import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value));

const moneyField = z.coerce
  .number()
  .min(0, "El monto no puede ser negativo.")
  .max(999_999_999.99, "Monto demasiado alto.");

export const businessSettingsSchema = z.object({
  businessName: z.string().trim().min(1, "Nombre comercial requerido.").max(200),
  legalName: optionalText(200),
  logoUrl: optionalText(500),
  address: optionalText(500),
  phone: optionalText(20),
  whatsapp: optionalText(20),
  email: z
    .email("Correo inválido.")
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value)),
  currency: z.string().trim().length(3).default("USD"),
  timezone: z.string().trim().min(1).default("America/El_Salvador"),
  quoteTerms: optionalText(10000),
  contractTerms: optionalText(10000),
  defaultDeposit: moneyField.default(0),
  defaultInsurance: moneyField.default(0),
  defaultDeliveryFee: moneyField.default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  extraDayGraceHours: z.coerce.number().min(0).max(24).default(2),
  receiptTemplateUrl: optionalText(500),
  contractTemplateUrl: optionalText(500),
  policies: optionalText(10000),
});

export type BusinessSettingsInput = z.infer<typeof businessSettingsSchema>;

export const settingsUpdateSchema = businessSettingsSchema.partial();

export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
