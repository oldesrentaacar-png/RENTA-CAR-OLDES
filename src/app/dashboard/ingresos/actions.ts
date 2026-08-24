"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  financeSearchSchema,
  incomeSchema,
  incomeUpdateSchema,
} from "@/lib/validation/finance";
import type { IncomeTransaction } from "@/types/database";
import type { PaginatedResult } from "@/types/api";

function parseIncomeForm(formData: FormData) {
  return {
    type: formData.get("type"),
    amount: formData.get("amount"),
    transactionDate: formData.get("transactionDate"),
    vehicleId: formData.get("vehicleId"),
    reservationId: formData.get("reservationId"),
    contractId: formData.get("contractId"),
    customerId: formData.get("customerId"),
    paymentMethod: formData.get("paymentMethod") || "CASH",
    depositStatus: formData.get("depositStatus"),
    reference: formData.get("reference"),
    notes: formData.get("notes"),
  };
}

function incomeInputToRow(input: ReturnType<typeof incomeSchema.parse>) {
  return {
    type: input.type,
    amount: input.amount,
    transaction_date: input.transactionDate,
    vehicle_id: input.vehicleId ?? null,
    reservation_id: input.reservationId ?? null,
    contract_id: input.contractId ?? null,
    customer_id: input.customerId ?? null,
    payment_method: input.paymentMethod,
    deposit_status: input.type === "DEPOSIT" ? input.depositStatus ?? null : null,
    reference: input.reference ?? null,
    notes: input.notes ?? null,
  };
}

export async function listIncomeTransactions(
  params: Record<string, string | string[] | undefined> = {},
): Promise<ActionResult<PaginatedResult<IncomeTransaction>>> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const filters = financeSearchSchema.parse({
      from: params.from,
      to: params.to,
      vehicleId: params.vehicleId,
      page: params.page,
      pageSize: params.pageSize,
    });

    const supabase = await createClient();
    let query = supabase
      .from("income_transactions")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false });

    if (filters.from) query = query.gte("transaction_date", filters.from);
    if (filters.to) query = query.lte("transaction_date", filters.to);
    if (filters.vehicleId) query = query.eq("vehicle_id", filters.vehicleId);

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw mapPostgresError(error);

    return actionSuccess({
      items: (data ?? []) as IncomeTransaction[],
      total: count ?? 0,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / filters.pageSize)),
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getIncomeTransaction(
  id: string,
): Promise<ActionResult<IncomeTransaction>> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("income_transactions")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!data) return actionError("Ingreso no encontrado.");

    return actionSuccess(data as IncomeTransaction);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function createIncomeTransaction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("finance.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = incomeSchema.safeParse(parseIncomeForm(formData));
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("income_transactions")
      .insert({
        ...incomeInputToRow(parsed.data),
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) throw mapPostgresError(error);

    const id = (data as { id: string }).id;
    await writeAuditLog({
      userId: user.id,
      action: "income.create",
      entityType: "income_transaction",
      entityId: id,
      metadata: { type: parsed.data.type, amount: parsed.data.amount },
    });

    revalidatePath("/dashboard/ingresos");
    revalidatePath("/dashboard/finanzas");
    revalidatePath("/dashboard/reportes");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function updateIncomeTransaction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("finance.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = incomeUpdateSchema.safeParse(parseIncomeForm(formData));
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const row: Record<string, unknown> = {};
    if (parsed.data.type !== undefined) row.type = parsed.data.type;
    if (parsed.data.amount !== undefined) row.amount = parsed.data.amount;
    if (parsed.data.transactionDate !== undefined) {
      row.transaction_date = parsed.data.transactionDate;
    }
    if (parsed.data.vehicleId !== undefined) {
      row.vehicle_id = parsed.data.vehicleId ?? null;
    }
    if (parsed.data.reservationId !== undefined) {
      row.reservation_id = parsed.data.reservationId ?? null;
    }
    if (parsed.data.contractId !== undefined) {
      row.contract_id = parsed.data.contractId ?? null;
    }
    if (parsed.data.customerId !== undefined) {
      row.customer_id = parsed.data.customerId ?? null;
    }
    if (parsed.data.paymentMethod !== undefined) {
      row.payment_method = parsed.data.paymentMethod;
    }
    if (parsed.data.reference !== undefined) {
      row.reference = parsed.data.reference ?? null;
    }
    if (parsed.data.notes !== undefined) row.notes = parsed.data.notes ?? null;
    if (parsed.data.depositStatus !== undefined) {
      row.deposit_status = parsed.data.depositStatus ?? null;
    }
    if (parsed.data.type !== undefined && parsed.data.type !== "DEPOSIT") {
      row.deposit_status = null;
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("income_transactions")
      .update(row)
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "income.update",
      entityType: "income_transaction",
      entityId: id,
    });

    revalidatePath("/dashboard/ingresos");
    revalidatePath("/dashboard/finanzas");
    revalidatePath("/dashboard/reportes");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function deleteIncomeTransaction(
  id: string,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("finance.delete");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("income_transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "income.delete",
      entityType: "income_transaction",
      entityId: id,
    });

    revalidatePath("/dashboard/ingresos");
    revalidatePath("/dashboard/finanzas");
    revalidatePath("/dashboard/reportes");
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function listFinanceOptions(): Promise<
  ActionResult<{
    vehicles: Array<{ id: string; label: string }>;
    customers: Array<{ id: string; label: string }>;
    reservations: Array<{ id: string; label: string }>;
  }>
> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const [vehiclesRes, customersRes, reservationsRes] = await Promise.all([
      supabase
        .from("vehicles")
        .select("id, brand, model, plate")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("brand"),
      supabase
        .from("customers")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("first_name"),
      supabase
        .from("reservations")
        .select("id, code")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const firstError =
      vehiclesRes.error ?? customersRes.error ?? reservationsRes.error;
    if (firstError) throw mapPostgresError(firstError);

    return actionSuccess({
      vehicles: (vehiclesRes.data ?? []).map((row) => {
        const v = row as { id: string; brand: string; model: string; plate: string };
        return { id: v.id, label: `${v.brand} ${v.model} (${v.plate})` };
      }),
      customers: (customersRes.data ?? []).map((row) => {
        const c = row as { id: string; first_name: string; last_name: string };
        return { id: c.id, label: `${c.first_name} ${c.last_name}` };
      }),
      reservations: (reservationsRes.data ?? []).map((row) => {
        const r = row as { id: string; code: string };
        return { id: r.id, label: r.code };
      }),
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
