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

const reservationFields = z.object({
  customerId: z.uuid("Cliente inválido."),
  vehicleId: z.uuid("Vehículo inválido."),
  quoteId: z.uuid().optional(),
  startAt: z.iso.datetime({ message: "Fecha de inicio inválida." }),
  endAt: z.iso.datetime({ message: "Fecha de fin inválida." }),
  pickupLocation: optionalText(255),
  returnLocation: optionalText(255),
  vehicleType: optionalText(100),
  agreedRate: moneyField,
  deposit: moneyField.default(0),
  insurance: moneyField.default(0),
  total: moneyField,
  cashAmount: moneyField.default(0),
  cardAmount: moneyField.default(0),
  additionalCosts: moneyField.default(0),
  notes: optionalText(2000),
  status: z
    .enum(["CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED"])
    .default("CONFIRMED"),
});

export const reservationSchema = reservationFields.refine(
  (data) => new Date(data.endAt) > new Date(data.startAt),
  {
    message: "La fecha de fin debe ser posterior a la de inicio.",
    path: ["endAt"],
  },
);

export const reservationUpdateSchema = reservationFields
  .partial()
  .refine(
    (data) => {
      if (!data.startAt || !data.endAt) return true;
      return new Date(data.endAt) > new Date(data.startAt);
    },
    {
      message: "La fecha de fin debe ser posterior a la de inicio.",
      path: ["endAt"],
    },
  );

export const reservationCancelSchema = z.object({
  reason: optionalText(500),
});

export type ReservationInput = z.infer<typeof reservationSchema>;
export type ReservationUpdateInput = z.infer<typeof reservationUpdateSchema>;

export const reservationSearchSchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z
    .enum(["CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED"])
    .optional(),
  vehicleId: z.uuid().optional(),
  customerId: z.uuid().optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ReservationSearchInput = z.infer<typeof reservationSearchSchema>;
