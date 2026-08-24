import { z } from "zod";

export const webRequestStatusSchema = z.enum([
  "PENDING",
  "CONTACTED",
  "QUOTED",
  "CONVERTED",
  "REJECTED",
  "CANCELLED",
]);

export const webRequestSearchSchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: webRequestStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const webRequestStatusUpdateSchema = z.object({
  status: webRequestStatusSchema,
  notes: z.string().trim().max(500).optional(),
});

export const linkCustomerToRequestSchema = z.object({
  customerId: z.uuid("Cliente inválido."),
});

export type WebRequestSearchInput = z.infer<typeof webRequestSearchSchema>;
