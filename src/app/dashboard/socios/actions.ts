"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  partnerRentalSchema,
  partnerRentalUpdateSchema,
} from "@/lib/validation/settlement";
import type { PaginatedResult } from "@/types/api";
import type { PartnerRental } from "@/types/database";

function parsePartnerRentalForm(formData: FormData) {
  return {
    customerId: formData.get("customerId"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    vehicleId: formData.get("vehicleId"),
    vehicleLabel: formData.get("vehicleLabel"),
    plate: formData.get("plate"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    clientCharged: formData.get("clientCharged"),
    partnerShare: formData.get("partnerShare"),
    ownShare: formData.get("ownShare"),
    status: formData.get("status"),
    paidByClient: formData.get("paidByClient"),
    notes: formData.get("notes"),
  };
}

function partnerRentalInputToRow(
  input: ReturnType<typeof partnerRentalSchema.parse>,
) {
  return {
    customer_id: input.customerId ?? null,
    customer_name: input.customerName,
    customer_phone: input.customerPhone ?? null,
    vehicle_id: input.vehicleId ?? null,
    vehicle_label: input.vehicleLabel ?? null,
    plate: input.plate ?? null,
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
    client_charged: input.clientCharged,
    partner_share: input.partnerShare,
    own_share: input.ownShare,
    status: input.status,
    paid_by_client: input.paidByClient,
    notes: input.notes ?? null,
  };
}

export async function listPartnerRentals(): Promise<
  ActionResult<PaginatedResult<PartnerRental>>
> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error, count } = await supabase
      .from("partner_rentals")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw mapPostgresError(error);

    return actionSuccess({
      items: (data ?? []) as PartnerRental[],
      total: count ?? 0,
      page: 1,
      pageSize: 100,
      totalPages: 1,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getPartnerRental(
  id: string,
): Promise<ActionResult<PartnerRental>> {
  try {
    await assertPermission("finance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("partner_rentals")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!data) return actionError("Registro de socio no encontrado.");

    return actionSuccess(data as PartnerRental);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function createPartnerRental(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("finance.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = partnerRentalSchema.safeParse(parsePartnerRentalForm(formData));
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("partner_rentals")
      .insert({
        ...partnerRentalInputToRow(parsed.data),
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) throw mapPostgresError(error);
    const id = (data as { id: string }).id;

    await writeAuditLog({
      userId: user.id,
      action: "partner_rental.create",
      entityType: "partner_rental",
      entityId: id,
      metadata: {
        customerName: parsed.data.customerName,
        ownShare: parsed.data.ownShare,
      },
    });

    revalidatePath("/dashboard/socios");
    revalidatePath("/dashboard/balance");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function updatePartnerRental(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("finance.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = partnerRentalUpdateSchema.safeParse(
      parsePartnerRentalForm(formData),
    );
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const row: Record<string, unknown> = {};
    if (parsed.data.customerId !== undefined) {
      row.customer_id = parsed.data.customerId ?? null;
    }
    if (parsed.data.customerName !== undefined) row.customer_name = parsed.data.customerName;
    if (parsed.data.customerPhone !== undefined) {
      row.customer_phone = parsed.data.customerPhone ?? null;
    }
    if (parsed.data.vehicleId !== undefined) row.vehicle_id = parsed.data.vehicleId ?? null;
    if (parsed.data.vehicleLabel !== undefined) {
      row.vehicle_label = parsed.data.vehicleLabel ?? null;
    }
    if (parsed.data.plate !== undefined) row.plate = parsed.data.plate ?? null;
    if (parsed.data.startDate !== undefined) row.start_date = parsed.data.startDate ?? null;
    if (parsed.data.endDate !== undefined) row.end_date = parsed.data.endDate ?? null;
    if (parsed.data.clientCharged !== undefined) row.client_charged = parsed.data.clientCharged;
    if (parsed.data.partnerShare !== undefined) row.partner_share = parsed.data.partnerShare;
    if (parsed.data.ownShare !== undefined) row.own_share = parsed.data.ownShare;
    if (parsed.data.status !== undefined) row.status = parsed.data.status;
    if (parsed.data.paidByClient !== undefined) row.paid_by_client = parsed.data.paidByClient;
    if (parsed.data.notes !== undefined) row.notes = parsed.data.notes ?? null;

    const supabase = await createClient();
    const { error } = await supabase
      .from("partner_rentals")
      .update(row)
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "partner_rental.update",
      entityType: "partner_rental",
      entityId: id,
    });

    revalidatePath("/dashboard/socios");
    revalidatePath("/dashboard/balance");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function deletePartnerRental(
  id: string,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("finance.delete");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("partner_rentals")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "partner_rental.delete",
      entityType: "partner_rental",
      entityId: id,
    });

    revalidatePath("/dashboard/socios");
    revalidatePath("/dashboard/balance");
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
