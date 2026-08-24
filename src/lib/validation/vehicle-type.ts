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

export const vehicleTypeSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido.").max(120),
  dailyRate: moneyField,
  passengers: z.coerce.number().int().min(1).max(99).default(5),
  luggage: z.coerce.number().int().min(0).max(20).default(2),
  publishedOnWeb: z.boolean().default(false),
  imageUrl: optionalText(2000),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const vehicleTypeUpdateSchema = vehicleTypeSchema.partial();

export type VehicleTypeInput = z.infer<typeof vehicleTypeSchema>;
