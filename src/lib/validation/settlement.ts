import { z } from "zod";

import {
  emptyToUndefined,
  optionalDateYmd,
  optionalText,
  optionalUuid,
} from "@/lib/validation/form-helpers";

const moneyField = z.coerce
  .number()
  .min(0, "El monto no puede ser negativo.")
  .max(999_999_999.99, "Monto demasiado alto.");

const requiredMoney = moneyField.refine(
  (value) => value >= 0,
  "El monto no puede ser negativo.",
);

const dateYmd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.");

export const partnerRentalStatusEnum = z.enum([
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "BLOCKED",
  "ANNULLED",
]);

export const vendorLedgerKindEnum = z.enum(["CHARGE", "PAYMENT"]);

export const monthFilterSchema = z.object({
  month: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}$/, "Mes inválido.")
      .optional(),
  ),
});

export const settlementSchema = z.object({
  periodMonth: dateYmd,
  contractId: optionalUuid(),
  contractCode: optionalText(50),
  customerId: optionalUuid(),
  customerName: optionalText(200),
  vehicleId: optionalUuid(),
  vehicleLabel: optionalText(200),
  plate: optionalText(50),
  startAt: z.preprocess(emptyToUndefined, z.string().optional()),
  endAt: z.preprocess(emptyToUndefined, z.string().optional()),
  rentalDays: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(3650).optional(),
  ),
  billedAmount: requiredMoney,
  paymentsReceived: moneyField.default(0),
  oldesCost: moneyField.default(0),
  providerCost: moneyField.default(0),
  commission: moneyField.default(0),
  taxAmount: moneyField.default(0),
  extraCosts: moneyField.default(0),
  vendorId: optionalUuid(),
  notes: optionalText(1000),
});

export const partnerRentalSchema = z.object({
  customerId: optionalUuid(),
  customerName: z.string().trim().min(1, "Cliente requerido.").max(200),
  customerPhone: optionalText(50),
  vehicleId: optionalUuid(),
  vehicleLabel: optionalText(200),
  plate: optionalText(50),
  startDate: optionalDateYmd(),
  endDate: optionalDateYmd(),
  clientCharged: moneyField.default(0),
  partnerShare: moneyField.default(0),
  ownShare: moneyField.default(0),
  status: partnerRentalStatusEnum.default("IN_PROGRESS"),
  paidByClient: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  notes: optionalText(1000),
});

export const partnerRentalUpdateSchema = partnerRentalSchema.partial();

export const vendorSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido.").max(200),
  phone: optionalText(50),
  email: z.preprocess(
    emptyToUndefined,
    z.email("Correo inválido.").max(200).optional(),
  ),
  notes: optionalText(1000),
  isActive: z.preprocess((value) => value !== "false", z.boolean()).default(true),
});

export const vendorUpdateSchema = vendorSchema.partial();

export const vendorLedgerEntrySchema = z.object({
  vendorId: z.uuid("Proveedor inválido."),
  kind: vendorLedgerKindEnum,
  amount: moneyField.refine(
    (value) => value > 0,
    "El monto debe ser mayor a cero.",
  ),
  entryDate: dateYmd,
  concept: z.string().trim().min(1, "Concepto requerido.").max(200),
  settlementId: optionalUuid(),
  contractId: optionalUuid(),
  notes: optionalText(1000),
});

export type SettlementInput = z.infer<typeof settlementSchema>;
export type PartnerRentalInput = z.infer<typeof partnerRentalSchema>;
export type VendorInput = z.infer<typeof vendorSchema>;
export type VendorLedgerEntryInput = z.infer<typeof vendorLedgerEntrySchema>;
