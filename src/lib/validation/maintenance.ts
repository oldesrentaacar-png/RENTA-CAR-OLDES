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

export const maintenanceSchema = z.object({
  vehicleId: z.uuid("Vehículo inválido."),
  type: z.enum([
    "OIL",
    "BRAKES",
    "TIRES",
    "ENGINE",
    "TRANSMISSION",
    "AC",
    "ELECTRICAL",
    "BODY",
    "GENERAL",
    "OTHER",
  ]),
  description: z.string().trim().min(1, "Descripción requerida.").max(1000),
  maintenanceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  mileage: z.coerce.number().int().min(0).max(9_999_999).optional(),
  cost: moneyField.default(0),
  workshop: optionalText(200),
  nextDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value)),
  nextMileage: z.coerce.number().int().min(0).max(9_999_999).optional(),
  status: z
    .enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .default("SCHEDULED"),
  receiptPath: optionalText(500),
  notes: optionalText(2000),
});

export const maintenanceUpdateSchema = maintenanceSchema.partial();

export type MaintenanceInput = z.infer<typeof maintenanceSchema>;
export type MaintenanceUpdateInput = z.infer<typeof maintenanceUpdateSchema>;

export const maintenanceSearchSchema = z.object({
  vehicleId: z.uuid().optional(),
  status: maintenanceSchema.shape.status.optional(),
  type: maintenanceSchema.shape.type.optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type MaintenanceSearchInput = z.infer<typeof maintenanceSearchSchema>;
