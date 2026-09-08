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

export type WebRequestSearchInput = z.infer<typeof webRequestSearchSchema>;
