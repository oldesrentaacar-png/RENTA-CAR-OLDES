"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import { formatAppDate } from "@/lib/dates";
import { env, isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/env";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { formatMoney, toNumber } from "@/lib/money";
import { formatZodIssues, firstRelation } from "@/lib/validation/form-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  paymentReceiptSchema,
  paymentRefundSchema,
  paymentReceiptSearchSchema,
} from "@/lib/validation/payment-receipt";
import {
  buildPaymentReceiptWhatsAppMessage,
  buildWaMeLink,
} from "@/lib/whatsapp";
import type { PaymentMethod, PaymentReceipt } from "@/types/database";
import type { PaginatedResult } from "@/types/api";
import type { PaymentReceiptPdfProps } from "@/lib/pdf/payment-receipt-pdf";

function parseReceiptForm(formData: FormData) {
  return {
    customerId: formData.get("customerId"),
    contractId: formData.get("contractId"),
    reservationId: formData.get("reservationId"),
    amount: formData.get("amount"),
    paymentMethod: formData.get("paymentMethod") || "CASH",
    concept: formData.get("concept") || "Abono",
    notes: formData.get("notes"),
    createIncome: formData.get("createIncome") ?? "true",
    incomeType: formData.get("incomeType") || "RENTAL",
  };
}

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = String(
    (error as { message?: string }).message ??
      (error as { details?: string }).details ??
      "",
  ).toLowerCase();
  return (
    message.includes("column") &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
}

type ContractBillingSnapshot = {
  owed: number;
  previousPaid: number;
  newPaid: number;
  balanceDue: number;
  paymentStatus: "PENDING" | "PARTIAL" | "PAID";
};

async function readContractBilling(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contractId: string,
  abonoAmount: number,
): Promise<ContractBillingSnapshot | null> {
  try {
    const { data, error } = await supabase
      .from("contracts")
      .select(
        "total, amount_paid, extra_charges, damage_charges, fuel_charges, complementary_amount",
      )
      .eq("id", contractId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      if (isMissingColumnError(error)) return null;
      throw mapPostgresError(error);
    }
    if (!data) return null;

    const row = data as {
      total: number;
      amount_paid?: number | null;
      extra_charges?: number | null;
      damage_charges?: number | null;
      fuel_charges?: number | null;
      complementary_amount?: number | null;
    };

    const charges =
      Number(row.extra_charges ?? 0) +
      Number(row.damage_charges ?? 0) +
      Number(row.fuel_charges ?? 0) +
      Number(row.complementary_amount ?? 0);
    const owed = Number(row.total ?? 0) + charges;
    const previousPaid = Number(row.amount_paid ?? 0);
    const newPaid = toNumber(previousPaid + abonoAmount);
    const balanceDue = Math.max(0, toNumber(owed - newPaid));
    const paymentStatus =
      balanceDue <= 0 ? "PAID" : newPaid > 0 ? "PARTIAL" : "PENDING";

    return { owed, previousPaid, newPaid, balanceDue, paymentStatus };
  } catch (error) {
    if (isMissingColumnError(error)) return null;
    throw error;
  }
}

async function readContractBillingForRefund(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contractId: string,
  refundAmount: number,
): Promise<ContractBillingSnapshot | null> {
  try {
    const { data, error } = await supabase
      .from("contracts")
      .select(
        "total, amount_paid, extra_charges, damage_charges, fuel_charges, complementary_amount",
      )
      .eq("id", contractId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      if (isMissingColumnError(error)) return null;
      throw mapPostgresError(error);
    }
    if (!data) return null;

    const row = data as {
      total: number;
      amount_paid?: number | null;
      extra_charges?: number | null;
      damage_charges?: number | null;
      fuel_charges?: number | null;
      complementary_amount?: number | null;
    };

    const charges =
      Number(row.extra_charges ?? 0) +
      Number(row.damage_charges ?? 0) +
      Number(row.fuel_charges ?? 0) +
      Number(row.complementary_amount ?? 0);
    const owed = Number(row.total ?? 0) + charges;
    const previousPaid = Number(row.amount_paid ?? 0);
    const newPaid = Math.max(0, toNumber(previousPaid - refundAmount));
    const balanceDue = Math.max(0, toNumber(owed - newPaid));
    const paymentStatus =
      balanceDue <= 0 ? "PAID" : newPaid > 0 ? "PARTIAL" : "PENDING";

    return { owed, previousPaid, newPaid, balanceDue, paymentStatus };
  } catch (error) {
    if (isMissingColumnError(error)) return null;
    throw error;
  }
}

async function tryUpdateContractBilling(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contractId: string,
  snapshot: ContractBillingSnapshot,
): Promise<boolean> {
  try {
    const dbClient = isSupabaseAdminConfigured()
      ? createAdminClient()
      : supabase;
    const { error: updateError } = await dbClient
      .from("contracts")
      .update({
        amount_paid: snapshot.newPaid,
        balance_due: snapshot.balanceDue,
        payment_status: snapshot.paymentStatus,
      })
      .eq("id", contractId)
      .is("deleted_at", null);

    if (updateError) {
      if (isMissingColumnError(updateError)) return false;
      throw mapPostgresError(updateError);
    }
    return true;
  } catch (error) {
    if (isMissingColumnError(error)) return false;
    throw error;
  }
}
export async function listPaymentReceipts(
  params: Record<string, string | string[] | undefined> = {},
): Promise<ActionResult<PaginatedResult<PaymentReceipt>>> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const filters = paymentReceiptSearchSchema.parse({
      contractId: params.contractId,
      customerId: params.customerId,
      receiptKind: params.receiptKind,
      page: params.page,
      pageSize: params.pageSize,
    });

    const supabase = await createClient();
    let query = supabase
      .from("payment_receipts")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("issued_at", { ascending: false });

    if (filters.contractId) query = query.eq("contract_id", filters.contractId);
    if (filters.customerId) query = query.eq("customer_id", filters.customerId);
    if (filters.receiptKind) query = query.eq("receipt_kind", filters.receiptKind);

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw mapPostgresError(error);

    return actionSuccess({
      items: (data ?? []) as PaymentReceipt[],
      total: count ?? 0,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / filters.pageSize)),
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getPaymentReceipt(
  id: string,
): Promise<ActionResult<PaymentReceipt>> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payment_receipts")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!data) return actionError("Recibo no encontrado.");

    return actionSuccess(data as PaymentReceipt);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function createPaymentReceipt(
  formData: FormData,
): Promise<ActionResult<{ id: string; code: string }>> {
  try {
    const { user } = await assertPermission("finance.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = paymentReceiptSchema.safeParse(parseReceiptForm(formData));
    if (!parsed.success) {
      return actionError(formatZodIssues(parsed.error));
    }

    const input = parsed.data;
    const supabase = await createClient();

    let customerId = input.customerId ?? null;
    let reservationId = input.reservationId ?? null;
    let vehicleId: string | null = null;
    let contractTotal = 0;

    if (input.contractId) {
      const { data: contract, error: contractError } = await supabase
        .from("contracts")
        .select("id, customer_id, vehicle_id, reservation_id, total, code")
        .eq("id", input.contractId)
        .is("deleted_at", null)
        .maybeSingle();

      if (contractError) throw mapPostgresError(contractError);
      if (!contract) return actionError("Contrato no encontrado.");

      const c = contract as {
        id: string;
        customer_id: string;
        vehicle_id: string;
        reservation_id: string;
        total: number;
        code: string;
      };

      customerId = customerId ?? c.customer_id;
      reservationId = reservationId ?? c.reservation_id;
      vehicleId = c.vehicle_id;
      contractTotal = Number(c.total ?? 0);
    }

    if (!customerId) {
      return actionError("Debe indicar el cliente o un contrato.");
    }

    const billing = input.contractId
      ? await readContractBilling(supabase, input.contractId, input.amount)
      : null;

    const balanceRemaining =
      billing?.balanceDue ??
      (input.contractId
        ? Math.max(0, toNumber(contractTotal - input.amount))
        : 0);

    const { data: receipt, error: receiptError } = await supabase
      .from("payment_receipts")
      .insert({
        customer_id: customerId,
        contract_id: input.contractId ?? null,
        reservation_id: reservationId,
        amount: input.amount,
        payment_method: input.paymentMethod,
        concept: input.concept,
        balance_remaining: balanceRemaining,
        notes: input.notes ?? null,
        receipt_kind: input.receiptKind ?? "PAYMENT",
        created_by: user.id,
      })
      .select("id, code")
      .single();

    if (receiptError) throw mapPostgresError(receiptError);

    const receiptRow = receipt as { id: string; code: string };

    if (input.contractId && billing) {
      await tryUpdateContractBilling(supabase, input.contractId, billing);
    }

    let incomeId: string | null = null;
    if (input.createIncome) {
      const today = new Date().toISOString().slice(0, 10);
      const incomePayload: Record<string, unknown> = {
        type: input.incomeType,
        amount: input.amount,
        transaction_date: today,
        vehicle_id: vehicleId,
        reservation_id: reservationId,
        contract_id: input.contractId ?? null,
        customer_id: customerId,
        payment_method: input.paymentMethod,
        deposit_status: input.incomeType === "DEPOSIT" ? "RECEIVED" : null,
        reference: receiptRow.code,
        notes: input.notes ?? `Abono ${receiptRow.code} — ${input.concept}`,
        created_by: user.id,
      };

      const withReceipt = { ...incomePayload, receipt_id: receiptRow.id };
      let incomeRes = await supabase
        .from("income_transactions")
        .insert(withReceipt)
        .select("id")
        .single();

      if (incomeRes.error && isMissingColumnError(incomeRes.error)) {
        incomeRes = await supabase
          .from("income_transactions")
          .insert(incomePayload)
          .select("id")
          .single();
      }

      if (incomeRes.error) throw mapPostgresError(incomeRes.error);
      incomeId = (incomeRes.data as { id: string }).id;

      await supabase
        .from("payment_receipts")
        .update({ income_id: incomeId })
        .eq("id", receiptRow.id);
    }

    await writeAuditLog({
      userId: user.id,
      action: "receipt.create",
      entityType: "payment_receipt",
      entityId: receiptRow.id,
      metadata: {
        code: receiptRow.code,
        amount: input.amount,
        contractId: input.contractId,
        incomeId,
      },
    });

    revalidatePath("/dashboard/recibos");
    revalidatePath("/dashboard/ingresos");
    revalidatePath("/dashboard/finanzas");
    if (input.contractId) {
      revalidatePath(`/dashboard/contratos/${input.contractId}`);
    }
    revalidatePath("/dashboard/contratos");

    return actionSuccess({ id: receiptRow.id, code: receiptRow.code });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function createPaymentRefund(
  formData: FormData,
): Promise<ActionResult<{ id: string; code: string }>> {
  try {
    const { user } = await assertPermission("finance.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = paymentRefundSchema.safeParse({
      ...parseReceiptForm(formData),
      receiptKind: "REFUND",
      createIncome: "false",
    });
    if (!parsed.success) {
      return actionError(formatZodIssues(parsed.error));
    }

    const input = parsed.data;
    if (!input.contractId) {
      return actionError("La devolución debe estar vinculada a un contrato.");
    }

    const supabase = await createClient();
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("id, customer_id, vehicle_id, reservation_id, total, code, amount_paid")
      .eq("id", input.contractId)
      .is("deleted_at", null)
      .maybeSingle();

    if (contractError) throw mapPostgresError(contractError);
    if (!contract) return actionError("Contrato no encontrado.");

    const c = contract as {
      id: string;
      customer_id: string;
      reservation_id: string;
      amount_paid?: number | null;
    };

    const previousPaid = Number(c.amount_paid ?? 0);
    if (input.amount > previousPaid) {
      return actionError(
        `La devolución no puede superar lo abonado (${formatMoney(previousPaid)}).`,
      );
    }

    const customerId = input.customerId ?? c.customer_id;
    const billing = await readContractBillingForRefund(
      supabase,
      input.contractId,
      input.amount,
    );

    const balanceRemaining = billing?.balanceDue ?? 0;

    const insertPayload: Record<string, unknown> = {
      customer_id: customerId,
      contract_id: input.contractId,
      reservation_id: input.reservationId ?? c.reservation_id,
      amount: input.amount,
      payment_method: input.paymentMethod,
      concept: input.concept,
      balance_remaining: balanceRemaining,
      notes: input.notes ?? null,
      receipt_kind: "REFUND",
      created_by: user.id,
    };

    let receiptRes = await supabase
      .from("payment_receipts")
      .insert(insertPayload)
      .select("id, code")
      .single();

    if (receiptRes.error && isMissingColumnError(receiptRes.error)) {
      delete insertPayload.receipt_kind;
      receiptRes = await supabase
        .from("payment_receipts")
        .insert(insertPayload)
        .select("id, code")
        .single();
    }

    if (receiptRes.error) throw mapPostgresError(receiptRes.error);
    const receiptRow = receiptRes.data as { id: string; code: string };

    if (billing) {
      await tryUpdateContractBilling(supabase, input.contractId, billing);
    }

    await writeAuditLog({
      userId: user.id,
      action: "receipt.refund",
      entityType: "payment_receipt",
      entityId: receiptRow.id,
      metadata: {
        code: receiptRow.code,
        amount: input.amount,
        contractId: input.contractId,
      },
    });

    revalidatePath("/dashboard/recibos");
    revalidatePath("/dashboard/ingresos");
    revalidatePath("/dashboard/finanzas");
    revalidatePath(`/dashboard/contratos/${input.contractId}`);
    revalidatePath("/dashboard/contratos");

    return actionSuccess({ id: receiptRow.id, code: receiptRow.code });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getReceiptWhatsAppLink(
  id: string,
): Promise<ActionResult<{ url: string }>> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payment_receipts")
      .select(
        "code, amount, concept, receipt_kind, customers(first_name, last_name, phone, whatsapp)",
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!data) return actionError("Recibo no encontrado.");

    const row = data as unknown as {
      code: string;
      amount: number;
      concept: string;
      receipt_kind?: "PAYMENT" | "REFUND";
      customers:
        | {
            first_name: string;
            last_name: string;
            phone: string | null;
            whatsapp: string | null;
          }
        | Array<{
            first_name: string;
            last_name: string;
            phone: string | null;
            whatsapp: string | null;
          }>;
    };

    const customer = firstRelation(row.customers);
    if (!customer) {
      return actionError("No se encontró el cliente asociado al recibo.");
    }

    const phone = customer.whatsapp || customer.phone;
    if (!phone?.trim()) {
      return actionError(
        "El cliente no tiene teléfono o WhatsApp registrado. Actualice los datos del cliente.",
      );
    }

    const appUrl = env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    const pdfUrl = appUrl ? `${appUrl}/api/receipts/${id}/pdf` : null;

    const message = buildPaymentReceiptWhatsAppMessage({
      customerName: `${customer.first_name} ${customer.last_name}`.trim(),
      receiptCode: row.code,
      amountLabel: formatMoney(row.amount),
      concept: row.concept,
      pdfUrl,
      receiptKind: row.receipt_kind ?? "PAYMENT",
    });

    return actionSuccess({ url: buildWaMeLink(phone, message) });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getPaymentReceiptPdfData(
  receiptId: string,
): Promise<PaymentReceiptPdfProps | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_receipts")
    .select(
      "*, customers(first_name, last_name, phone, identification, dui, passport), contracts(code, total, amount_paid, vehicles(brand, model, plate))",
    )
    .eq("id", receiptId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return null;

  const { data: settings } = await supabase
    .from("business_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  let receivedByName: string | null = null;
  if (authUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", authUser.id)
      .maybeSingle();
    if (profile) {
      const p = profile as { first_name: string; last_name: string };
      receivedByName = `${p.first_name} ${p.last_name}`.trim();
    }
  }

  const row = data as PaymentReceipt & {
    customers: {
      first_name: string;
      last_name: string;
      phone: string | null;
      identification?: string | null;
      dui?: string | null;
      passport?: string | null;
    };
    contracts: {
      code: string;
      total?: number | null;
      amount_paid?: number | null;
      vehicles?: { brand: string; model: string; plate: string } | null;
    } | null;
    reservations: { code: string } | null;
  };

  // reservations may not be in select - fetch code if needed via contract only
  const settingsRow = settings as {
    business_name?: string;
    address?: string;
    phone?: string;
    email?: string;
    whatsapp?: string;
    policies?: Record<string, unknown> | null;
  } | null;

  const policies = settingsRow?.policies ?? {};
  const templateImageUrl =
    typeof policies.receiptTemplateUrl === "string"
      ? policies.receiptTemplateUrl
      : null;

  const method = row.payment_method as PaymentMethod;
  const receiptKind =
    (row as PaymentReceipt & { receipt_kind?: "PAYMENT" | "REFUND" })
      .receipt_kind ?? "PAYMENT";

  const idDoc =
    row.customers.dui ||
    row.customers.passport ||
    row.customers.identification ||
    null;
  const vehicle = row.contracts?.vehicles;
  const vehicleLabel = vehicle
    ? `${vehicle.brand} ${vehicle.model}`.trim()
    : null;

  const { amountToSpanishUsd } = await import("@/lib/contracts/oldes-terms");

  return {
    businessName: settingsRow?.business_name ?? "OLDES Rent-a-Car",
    businessAddress: settingsRow?.address ?? null,
    businessPhone: settingsRow?.phone ?? null,
    businessEmail: settingsRow?.email ?? null,
    businessWhatsapp: settingsRow?.whatsapp ?? null,
    contactPhone:
      settingsRow?.whatsapp || settingsRow?.phone || "+503 7435-0381",
    receiptCode: row.code,
    issuedAtLabel: formatAppDate(row.issued_at),
    customerName: `${row.customers.first_name} ${row.customers.last_name}`,
    customerPhone: row.customers.phone,
    customerIdentification: idDoc,
    concept: row.concept,
    amount: Number(row.amount),
    amountInWords: amountToSpanishUsd(Number(row.amount)),
    paymentMethodLabel: PAYMENT_METHOD_LABELS[method] ?? method,
    paymentMethod: method,
    contractCode: row.contracts?.code ?? null,
    reservationCode: null,
    vehicleLabel,
    plate: vehicle?.plate ?? null,
    accountTotal:
      row.contracts?.total != null ? Number(row.contracts.total) : null,
    balanceRemaining: Number(row.balance_remaining ?? 0),
    notes: row.notes,
    receiptKind,
    templateImageUrl,
    receivedByName,
  };
}
