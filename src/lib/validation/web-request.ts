import { z } from "zod";

import {
  optionalEnum,
  optionalText,
} from "@/lib/validation/form-helpers";

export const webRequestStatusSchema = z.enum([
  "PENDING",
  "CONTACTED",
  "QUOTED",
  "CONVERTED",
  "REJECTED",
  "CANCELLED",
]);

export const webRequestSearchSchema = z.object({
  query: optionalText(100),
  status: optionalEnum(webRequestStatusSchema),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const webRequestStatusUpdateSchema = z.object({
  status: webRequestStatusSchema,
  notes: optionalText(500),
});

export const linkCustomerToRequestSchema = z.object({
  customerId: z.uuid("Cliente inválido."),
});

export const webRequestUpdateSchema = z.object({
  firstName: z.string().trim().min(1, "Nombre requerido.").max(100),
  lastName: z.string().trim().min(1, "Apellido requerido.").max(100),
  phone: z.string().trim().min(7, "Teléfono inválido.").max(40),
  email: z
    .string()
    .trim()
    .email("Correo inválido.")
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value)),
  pickupDate: z.string().min(1, "Fecha de recogida requerida."),
  pickupTime: z.string().min(1, "Hora de recogida requerida."),
  returnDate: z.string().min(1, "Fecha de devolución requerida."),
  returnTime: z.string().min(1, "Hora de devolución requerida."),
  vehicleCategory: optionalText(120),
  pickupLocation: optionalText(200),
  returnLocation: optionalText(200),
  notes: optionalText(2000),
});

export type WebRequestSearchInput = z.infer<typeof webRequestSearchSchema>;
export type WebRequestUpdateInput = z.infer<typeof webRequestUpdateSchema>;
