import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value));

const optionalUuid = z
  .union([z.string().uuid(), z.literal("")])
  .optional()
  .transform((value) => (value === "" || value === undefined ? undefined : value));

export const inspectionSchema = z.object({
  reservationId: z.string().uuid("Reserva inválida."),
  vehicleId: z.string().uuid("Vehículo inválido."),
  customerId: z.string().uuid("Cliente inválido."),
  type: z.enum(["CHECK_OUT", "CHECK_IN"]),
  inspectionDate: z
    .string()
    .min(1, "Fecha de inspección requerida.")
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Fecha de inspección inválida.",
    }),
  mileage: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().min(0).max(9_999_999).optional(),
  ),
  fuelLevel: z
    .enum([
      "EMPTY",
      "ONE_EIGHTH",
      "QUARTER",
      "THREE_EIGHTHS",
      "HALF",
      "FIVE_EIGHTHS",
      "THREE_QUARTERS",
      "SEVEN_EIGHTHS",
      "FULL",
    ])
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value)),
  handoverPersonName: optionalText(200),
  additionalDriverName: optionalText(200),
  notes: optionalText(2000),
});

export const inspectionUpdateSchema = inspectionSchema.partial();

export const checklistItemSchema = z.object({
  itemKey: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(200),
  status: z.enum(["OK", "DAMAGED", "MISSING", "NOT_APPLICABLE"]),
  notes: optionalText(500),
});

export const damageMarkSchema = z.object({
  view: z.enum(["TOP", "FRONT", "REAR", "LEFT", "RIGHT"]),
  x: z.coerce.number().min(0).max(1),
  y: z.coerce.number().min(0).max(1),
  damageType: z.enum([
    "SCRATCH",
    "DENT",
    "CRACK",
    "PAINT",
    "BROKEN",
    "OTHER",
  ]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  description: optionalText(500),
  photoId: z.uuid().optional(),
});

export const inspectionPhotoSchema = z.object({
  category: z.enum([
    "FRONT",
    "REAR",
    "LEFT",
    "RIGHT",
    "INTERIOR",
    "DASHBOARD",
    "WHEELS",
    "DAMAGE",
    "OTHER",
  ]),
  storagePath: z.string().trim().min(1).max(500),
  caption: optionalText(255),
});

export type InspectionInput = z.infer<typeof inspectionSchema>;
export type InspectionUpdateInput = z.infer<typeof inspectionUpdateSchema>;
export type ChecklistItemInput = z.infer<typeof checklistItemSchema>;
export type DamageMarkInput = z.infer<typeof damageMarkSchema>;
export type InspectionPhotoInput = z.infer<typeof inspectionPhotoSchema>;

export const inspectionSearchSchema = z.object({
  reservationId: z.uuid().optional(),
  vehicleId: z.uuid().optional(),
  type: z.enum(["CHECK_OUT", "CHECK_IN"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type InspectionSearchInput = z.infer<typeof inspectionSearchSchema>;
