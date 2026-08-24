"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  expenseSchema,
  expenseUpdateSchema,
  financeSearchSchema,
} from "@/lib/validation/finance";
import type { ExpenseTransaction } from "@/types/database";
import type { PaginatedResult } from "@/types/api";

function parseExpenseForm(formData: FormData) {
  return {
    concept: formData.get("concept"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    expenseDate: formData.get("expenseDate"),
    vehicleId: formData.get("vehicleId"),
    provider: formData.get("provider"),
    receiptPath: formData.get("receiptPath"),
    notes: formData.get("notes"),
  };
}

function expenseInputToRow(input: ReturnType<typeof expenseSchema.parse>) {
  return {
    concept: input.concept,
    category: input.category,
    amount: input.amount,
    expense_date: input.expenseDate,
    vehicle_id: input.vehicleId ?? null,
    provider: input.provider ?? null,
    receipt_path: input.receiptPath ?? null,
    notes: input.notes ?? null,
  };
}

export async function getExpenseTransaction(
  id: string,
): Promise<ActionResult<ExpenseTransaction>> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("expense_transactions")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!data) return actionError("Gasto no encontrado.");

    return actionSuccess(data as ExpenseTransaction);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function listExpenseTransactions(
  params: Record<string, string | string[] | undefined> = {},
): Promise<ActionResult<PaginatedResult<ExpenseTransaction>>> {
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
      .from("expense_transactions")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("expense_date", { ascending: false });

    if (filters.from) query = query.gte("expense_date", filters.from);
    if (filters.to) query = query.lte("expense_date", filters.to);
    if (filters.vehicleId) query = query.eq("vehicle_id", filters.vehicleId);

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw mapPostgresError(error);

    return actionSuccess({
      items: (data ?? []) as ExpenseTransaction[],
      total: count ?? 0,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / filters.pageSize)),
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function createExpenseTransaction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("finance.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = expenseSchema.safeParse(parseExpenseForm(formData));
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("expense_transactions")
      .insert({
        ...expenseInputToRow(parsed.data),
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) throw mapPostgresError(error);

    const id = (data as { id: string }).id;
    await writeAuditLog({
      userId: user.id,
      action: "expense.create",
      entityType: "expense_transaction",
      entityId: id,
      metadata: {
        category: parsed.data.category,
        amount: parsed.data.amount,
      },
    });

    revalidatePath("/dashboard/gastos");
    revalidatePath("/dashboard/finanzas");
    revalidatePath("/dashboard/reportes");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function updateExpenseTransaction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("finance.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = expenseUpdateSchema.safeParse(parseExpenseForm(formData));
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const row: Record<string, unknown> = {};
    if (parsed.data.concept !== undefined) row.concept = parsed.data.concept;
    if (parsed.data.category !== undefined) row.category = parsed.data.category;
    if (parsed.data.amount !== undefined) row.amount = parsed.data.amount;
    if (parsed.data.expenseDate !== undefined) {
      row.expense_date = parsed.data.expenseDate;
    }
    if (parsed.data.vehicleId !== undefined) {
      row.vehicle_id = parsed.data.vehicleId ?? null;
    }
    if (parsed.data.provider !== undefined) {
      row.provider = parsed.data.provider ?? null;
    }
    if (parsed.data.notes !== undefined) row.notes = parsed.data.notes ?? null;
    if (parsed.data.receiptPath !== undefined) {
      row.receipt_path = parsed.data.receiptPath ?? null;
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("expense_transactions")
      .update(row)
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "expense.update",
      entityType: "expense_transaction",
      entityId: id,
    });

    revalidatePath("/dashboard/gastos");
    revalidatePath("/dashboard/finanzas");
    revalidatePath("/dashboard/reportes");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function deleteExpenseTransaction(
  id: string,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("finance.delete");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("expense_transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "expense.delete",
      entityType: "expense_transaction",
      entityId: id,
    });

    revalidatePath("/dashboard/gastos");
    revalidatePath("/dashboard/finanzas");
    revalidatePath("/dashboard/reportes");
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
