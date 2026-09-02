import { z } from "zod";

import { emptyToUndefined, optionalText } from "@/lib/validation/form-helpers";

const moneyField = z.coerce
  .number()
  .min(0, "El monto no puede ser negativo.")
  .max(999_999_999.99, "Monto demasiado alto.");

/** Query-string booleans: z.coerce.boolean() treats "false" as true. */
function queryBoolean() {
  return z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return undefined;
      if (value === "true" || value === true) return true;
      if (value === "false" || value === false) return false;
      return value;
    },
    z.boolean().optional(),
  );
}

const optionalMoneyField = z.preprocess(emptyToUndefined, moneyField.optional());

const optionalIntField = (min: number, max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(min).max(max).optional(),
  );

export const vehicleSchema = z.object({
  brand: z.string().trim().min(1, "Marca requerida.").max(100),
  model: z.string().trim().min(1, "Modelo requerido.").max(100),
  year: z.coerce
    .number()
    .int()
    .min(1980, "Año inválido.")
    .max(new Date().getFullYear() + 1),
  plate: z.string().trim().min(1, "Placa requerida.").max(20),
  vin: optionalText(50),
  chassis: optionalText(50),
  engine: optionalText(50),
  color: optionalText(50),
  transmission: optionalText(50),
  fuelType: optionalText(50),
  passengers: optionalIntField(1, 99),
  doors: optionalIntField(1, 10),
  luggage: optionalIntField(0, 20),
  airConditioning: z.boolean().default(true),
  category: optionalText(100),
  vehicleTypeId: z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined ? null : value,
    z.union([z.string().uuid(), z.null()]).optional(),
  ),
  ownershipType: z
    .enum(["OWN", "THIRD_PARTY", "SUBLEASED", "CONSIGNMENT"])
    .default("OWN"),
  dailyRate: moneyField.refine((v) => v >= 0.01, "Tarifa diaria requerida (mínimo $0.01)."),
  weeklyRate: optionalMoneyField,
  deposit: moneyField,
  publicDescription: optionalText(5000),
  ownerName: optionalText(200),
  ownerPhone: optionalText(20),
  subleaseDailyCost: optionalMoneyField,
  subleasePayeeName: optionalText(200),
  internalNotes: optionalText(5000),
  engineOil: optionalText(200),
  tireInfo: optionalText(200),
  currentMileage: optionalIntField(0, 9_999_999),
  status: z
    .enum([
      "AVAILABLE",
      "RESERVED",
      "RENTED",
      "MAINTENANCE",
      "UNAVAILABLE",
      "ARCHIVED",
    ])
    .default("AVAILABLE"),
  publishedOnWeb: z.boolean().default(false),
});

export const vehicleUpdateSchema = vehicleSchema.partial();

export const vehiclePublishSchema = z.object({
  publishedOnWeb: z.boolean(),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;
export type VehicleUpdateInput = z.infer<typeof vehicleUpdateSchema>;

export const vehicleSearchSchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z
    .enum([
      "AVAILABLE",
      "RESERVED",
      "RENTED",
      "MAINTENANCE",
      "UNAVAILABLE",
      "ARCHIVED",
    ])
    .optional(),
  publishedOnWeb: queryBoolean(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type VehicleSearchInput = z.infer<typeof vehicleSearchSchema>;
