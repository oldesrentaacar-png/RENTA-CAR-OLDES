"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import {
  customerInputToRow,
  mapCustomerRow,
  mapWebRequestRow,
  type CustomerRow,
  type WebRequestRow,
} from "@/lib/db/mappers";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { customerSchema } from "@/lib/validation/customer";
import {
  linkCustomerToRequestSchema,
  webRequestSearchSchema,
  webRequestStatusUpdateSchema,
} from "@/lib/validation/web-request";
import type { Customer, WebRequest } from "@/types/database";
import type { PaginatedResult } from "@/types/api";

export async function listWebRequests(
  params: Record<string, string | string[] | undefined> = {},
): Promise<ActionResult<PaginatedResult<WebRequest>>> {
  try {
    await assertPermission("requests.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const filters = webRequestSearchSchema.parse({
      query: params.q,
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
    });

    const supabase = await createClient();
    let query = supabase
      .from("web_requests")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.query) {
      const term = `%${filters.query}%`;
      query = query.or(
        `code.ilike.${term},first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term}`,
      );
    }

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw mapPostgresError(error);

    return actionSuccess({
      items: ((data ?? []) as WebRequestRow[]).map(mapWebRequestRow),
      total: count ?? 0,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / filters.pageSize)),
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getWebRequest(
  id: string,
): Promise<ActionResult<WebRequest>> {
  try {
    await assertPermission("requests.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("web_requests")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!data) return actionError("Solicitud no encontrada.");

    return actionSuccess(mapWebRequestRow(data as WebRequestRow));
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function updateWebRequestStatus(
  id: string,
  status: WebRequest["status"],
  notes?: string,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("requests.edit");
    const parsed = webRequestStatusUpdateSchema.safeParse({ status, notes });
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Estado inválido.");
    }

    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("web_requests")
      .update({ status: parsed.data.status })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "web_request.status_update",
      entityType: "web_request",
      entityId: id,
      metadata: { status: parsed.data.status, notes: parsed.data.notes },
    });

    revalidatePath("/dashboard/solicitudes");
    revalidatePath(`/dashboard/solicitudes/${id}`);
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function linkCustomerToRequest(
  requestId: string,
  customerId: string,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("requests.edit");
    const parsed = linkCustomerToRequestSchema.safeParse({ customerId });
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Cliente inválido.");
    }

    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("web_requests")
      .update({ customer_id: parsed.data.customerId })
      .eq("id", requestId)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "web_request.link_customer",
      entityType: "web_request",
      entityId: requestId,
      metadata: { customerId: parsed.data.customerId },
    });

    revalidatePath(`/dashboard/solicitudes/${requestId}`);
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function createCustomerFromRequest(
  requestId: string,
): Promise<ActionResult<{ customerId: string }>> {
  try {
    const { user } = await assertPermission("customers.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data: request, error: fetchError } = await supabase
      .from("web_requests")
      .select("*")
      .eq("id", requestId)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchError) throw mapPostgresError(fetchError);
    if (!request) return actionError("Solicitud no encontrada.");

    const row = request as WebRequestRow;
    const parsed = customerSchema.safeParse({
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      email: row.email ?? undefined,
      status: "ACTIVE",
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const { data: customer, error: createError } = await supabase
      .from("customers")
      .insert({
        ...customerInputToRow(parsed.data),
        created_by: user.id,
      })
      .select("id")
      .single();

    if (createError) throw mapPostgresError(createError);

    const customerId = (customer as { id: string }).id;
    await supabase
      .from("web_requests")
      .update({ customer_id: customerId })
      .eq("id", requestId);

    await writeAuditLog({
      userId: user.id,
      action: "customer.create_from_request",
      entityType: "customer",
      entityId: customerId,
      metadata: { requestId },
    });

    revalidatePath("/dashboard/clientes");
    revalidatePath(`/dashboard/solicitudes/${requestId}`);
    return actionSuccess({ customerId });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function markRequestContacted(
  id: string,
): Promise<ActionResult<void>> {
  return updateWebRequestStatus(id, "CONTACTED");
}

export async function rejectRequest(id: string): Promise<ActionResult<void>> {
  return updateWebRequestStatus(id, "REJECTED");
}

export async function convertRequest(id: string): Promise<ActionResult<void>> {
  return updateWebRequestStatus(id, "CONVERTED");
}

export async function searchCustomersForLink(
  query: string,
): Promise<ActionResult<Customer[]>> {
  try {
    await assertPermission("customers.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const term = `%${query.trim()}%`;
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .is("deleted_at", null)
      .or(
        `first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term}`,
      )
      .limit(10);

    if (error) throw mapPostgresError(error);

    return actionSuccess(
      ((data ?? []) as CustomerRow[]).map(mapCustomerRow),
    );
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
