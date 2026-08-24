"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import {
  customerInputToRow,
  mapContractRow,
  mapCustomerRow,
  mapQuoteRow,
  mapReservationRow,
  type ContractRow,
  type CustomerRow,
  type QuoteRow,
  type ReservationRow,
} from "@/lib/db/mappers";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  customerSchema,
  customerSearchSchema,
  customerUpdateSchema,
} from "@/lib/validation/customer";
import type {
  Contract,
  Customer,
  PaymentReceipt,
  Quote,
  Reservation,
} from "@/types/database";
import type { PaginatedResult } from "@/types/api";

function emptyToUndefined(value: FormDataEntryValue | null) {
  if (value == null) return undefined;
  const text = String(value);
  return text === "" ? undefined : text;
}

function parseCustomerFormData(formData: FormData) {
  return {
    customerType: formData.get("customerType") || "PERSON",
    firstName: emptyToUndefined(formData.get("firstName")),
    lastName: emptyToUndefined(formData.get("lastName")),
    companyName: emptyToUndefined(formData.get("companyName")),
    nit: emptyToUndefined(formData.get("nit")),
    nrc: emptyToUndefined(formData.get("nrc")),
    contactPerson: emptyToUndefined(formData.get("contactPerson")),
    identification: emptyToUndefined(formData.get("identification")),
    dui: emptyToUndefined(formData.get("dui")),
    passport: emptyToUndefined(formData.get("passport")),
    licenseNumber: emptyToUndefined(formData.get("licenseNumber")),
    licenseExpiry: emptyToUndefined(formData.get("licenseExpiry")),
    birthDate: emptyToUndefined(formData.get("birthDate")),
    phone: emptyToUndefined(formData.get("phone")),
    whatsapp: emptyToUndefined(formData.get("whatsapp")),
    email: emptyToUndefined(formData.get("email")),
    address: emptyToUndefined(formData.get("address")),
    country: emptyToUndefined(formData.get("country")),
    additionalDriverName: emptyToUndefined(formData.get("additionalDriverName")),
    additionalDriverLicense: emptyToUndefined(
      formData.get("additionalDriverLicense"),
    ),
    documentImageUrl: emptyToUndefined(formData.get("documentImageUrl")),
    licenseImageUrl: emptyToUndefined(formData.get("licenseImageUrl")),
    receiverName: emptyToUndefined(formData.get("receiverName")),
    delivererName: emptyToUndefined(formData.get("delivererName")),
    notes: emptyToUndefined(formData.get("notes")),
    status: formData.get("status") || "ACTIVE",
  };
}

export async function listCustomers(
  params: Record<string, string | string[] | undefined> = {},
): Promise<ActionResult<PaginatedResult<Customer>>> {
  try {
    await assertPermission("customers.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const filters = customerSearchSchema.parse({
      query: params.q,
      page: params.page,
      pageSize: params.pageSize,
    });

    const supabase = await createClient();
    let query = supabase
      .from("customers")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("last_name", { ascending: true });

    if (filters.query) {
      const term = `%${filters.query}%`;
      query = query.or(
        `first_name.ilike.${term},last_name.ilike.${term},company_name.ilike.${term},phone.ilike.${term},email.ilike.${term},nit.ilike.${term}`,
      );
    }

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw mapPostgresError(error);

    const items = ((data ?? []) as CustomerRow[]).map(mapCustomerRow);
    const total = count ?? 0;

    return actionSuccess({
      items,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getCustomer(id: string): Promise<ActionResult<Customer>> {
  try {
    await assertPermission("customers.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!data) return actionError("Cliente no encontrado.");

    return actionSuccess(mapCustomerRow(data as CustomerRow));
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export type CustomerProfileRelated = {
  quotes: Quote[];
  reservations: Reservation[];
  contracts: Contract[];
  receipts: PaymentReceipt[];
};

export async function getCustomerRelated(
  customerId: string,
): Promise<ActionResult<CustomerProfileRelated>> {
  try {
    await assertPermission("customers.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();

    const [quotesRes, reservationsRes, contractsRes, receiptsRes] =
      await Promise.all([
        supabase
          .from("quotes")
          .select("*")
          .eq("customer_id", customerId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("reservations")
          .select("*")
          .eq("customer_id", customerId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("contracts")
          .select("*")
          .eq("customer_id", customerId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("payment_receipts")
          .select("*")
          .eq("customer_id", customerId)
          .is("deleted_at", null)
          .order("issued_at", { ascending: false })
          .limit(50),
      ]);

    if (quotesRes.error) throw mapPostgresError(quotesRes.error);
    if (reservationsRes.error) throw mapPostgresError(reservationsRes.error);
    if (contractsRes.error) throw mapPostgresError(contractsRes.error);

    const receipts: PaymentReceipt[] = receiptsRes.error
      ? []
      : ((receiptsRes.data ?? []) as PaymentReceipt[]);

    return actionSuccess({
      quotes: ((quotesRes.data ?? []) as QuoteRow[]).map(mapQuoteRow),
      reservations: ((reservationsRes.data ?? []) as ReservationRow[]).map(
        mapReservationRow,
      ),
      contracts: ((contractsRes.data ?? []) as ContractRow[]).map(mapContractRow),
      receipts,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function createCustomer(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("customers.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = customerSchema.safeParse(parseCustomerFormData(formData));

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const supabase = await createClient();
    const row = {
      ...customerInputToRow(parsed.data),
      created_by: user.id,
    };

    const { data, error } = await supabase
      .from("customers")
      .insert(row)
      .select("id")
      .single();

    if (error) throw mapPostgresError(error);

    const id = (data as { id: string }).id;
    await writeAuditLog({
      userId: user.id,
      action: "customer.create",
      entityType: "customer",
      entityId: id,
    });

    revalidatePath("/dashboard/clientes");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function updateCustomer(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("customers.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const raw = parseCustomerFormData(formData);
    const parsed = customerUpdateSchema.safeParse({
      ...raw,
      phone: raw.phone,
      status: formData.get("status") || undefined,
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const data = { ...parsed.data };
    if (data.customerType === "COMPANY") {
      if (!data.firstName && data.companyName) data.firstName = data.companyName;
      if (!data.lastName) data.lastName = data.contactPerson ?? "-";
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("customers")
      .update(customerInputToRow(data))
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "customer.update",
      entityType: "customer",
      entityId: id,
    });

    revalidatePath("/dashboard/clientes");
    revalidatePath(`/dashboard/clientes/${id}`);
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function deleteCustomer(id: string): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("customers.delete");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("customers")
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "customer.soft_delete",
      entityType: "customer",
      entityId: id,
    });

    revalidatePath("/dashboard/clientes");
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
