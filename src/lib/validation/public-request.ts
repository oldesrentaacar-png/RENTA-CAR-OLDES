import { z } from "zod";

import { blankText } from "@/lib/validation/form-helpers";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida. Use YYYY-MM-DD.");

const timeString = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Hora inválida. Use HH:mm.");

const optionalText = blankText;

export const publicRequestSchema = z
  .object({
    firstName: z.string().trim().min(1, "Nombre requerido.").max(100),
    lastName: z.string().trim().min(1, "Apellido requerido.").max(100),
    phone: z
      .string()
      .trim()
      .min(7, "Teléfono inválido.")
      .max(20, "Teléfono demasiado largo."),
    email: z.preprocess(
      (value) => (value == null || value === "" ? undefined : value),
      z.email("Correo inválido.").optional(),
    ),
    pickupDate: dateString,
    pickupTime: timeString,
    returnDate: dateString,
    returnTime: timeString,
    /** Optional unit id — omit when requesting by vehicle type slug/name. */
    vehicleId: z.uuid("ID de vehículo inválido.").optional(),
    /** Type slug or category name (e.g. sedan, "SUV 2 filas") — no vehicle_id required. */
    vehicleCategory: optionalText(100),
    pickupLocation: optionalText(255),
    returnLocation: optionalText(255),
    notes: optionalText(2000),
    /** Honeypot — must remain empty. Bots often fill hidden fields. */
    website: z.preprocess(
      (value) => (value == null || value === "" ? undefined : value),
      z.string().max(0, "Solicitud rechazada.").optional(),
    ),
  })
  .refine(
    (data) => {
      const pickup = `${data.pickupDate}T${data.pickupTime}`;
      const returnAt = `${data.returnDate}T${data.returnTime}`;
      return returnAt > pickup;
    },
    {
      message: "La fecha de devolución debe ser posterior a la de recogida.",
      path: ["returnDate"],
    },
  );

export type PublicRequestInput = z.infer<typeof publicRequestSchema>;

export function isHoneypotTriggered(input: { website?: string }): boolean {
  return Boolean(input.website && input.website.trim().length > 0);
}
