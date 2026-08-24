"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  maintenanceSchema,
  maintenanceSearchSchema,
  maintenanceUpdateSchema,
} from "@/lib/validation/maintenance";
import type { MaintenanceRecord, Vehicle } from "@/types/database";
import type { PaginatedResult } from "@/types/api";

export type MaintenanceWithVehicle = MaintenanceRecord & {
  vehicle: Pick<Vehicle, "id" | "brand" | "model" | "plate" | "status"> | null;
};

function parseMaintenanceForm(formData: FormData) {
  return {
    vehicleId: formData.get("vehicleId"),
    type: formData.get("type"),
    description: formData.get("description"),
    maintenanceDate: formData.get("maintenanceDate"),
    mileage: formData.get("mileage") || undefined,
    cost: formData.get("cost") || 0,
    workshop: formData.get("workshop"),
    nextDate: formData.get("nextDate"),
    nextMileage: formData.get("nextMileage") || undefined,
    status: formData.get("status") || "SCHEDULED",
    notes: formData.get("notes"),
    setVehicleMaintenance: formData.get("setVehicleMaintenance") === "on",
  };
}

function maintenanceInputToRow(input: ReturnType<typeof maintenanceSchema.parse>) {
  return {
    vehicle_id: input.vehicleId,
    type: input.type,
    description: input.description,
    maintenance_date: input.maintenanceDate,
    mileage: input.mileage ?? null,
    cost: input.cost,
    workshop: input.workshop ?? null,
    next_date: input.nextDate ?? null,
    next_mileage: input.nextMileage ?? null,
    status: input.status,
    notes: input.notes ?? null,
  };
}

async function vehicleHasActiveReservation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vehicleId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_id", vehicleId)
    .in("status", ["CONFIRMED", "ACTIVE"])
    .is("deleted_at", null);

  if (error) throw mapPostgresError(error);
  return (count ?? 0) > 0;
}

async function syncVehicleStatusAfterMaintenance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vehicleId: string,
  newStatus: string,
  setVehicleMaintenance?: boolean,
) {
  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("status")
    .eq("id", vehicleId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw mapPostgresError(error);
  if (!vehicle) return;

  const currentStatus = (vehicle as { status: string }).status;

  if (newStatus === "IN_PROGRESS" && setVehicleMaintenance) {
    if (currentStatus !== "RENTED" && currentStatus !== "RESERVED") {
      await supabase
        .from("vehicles")
        .update({ status: "MAINTENANCE" })
        .eq("id", vehicleId);
    }
    return;
  }

  if (newStatus === "COMPLETED" && currentStatus === "MAINTENANCE") {
    const hasReservation = await vehicleHasActiveReservation(supabase, vehicleId);
    if (!hasReservation) {
      await supabase
        .from("vehicles")
        .update({ status: "AVAILABLE" })
        .eq("id", vehicleId);
    }
  }
}

export async function listMaintenanceRecords(
  params: Record<string, string | string[] | undefined> = {},
): Promise<ActionResult<PaginatedResult<MaintenanceWithVehicle>>> {
  try {
    await assertPermission("maintenance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const filters = maintenanceSearchSchema.parse({
      vehicleId: params.vehicleId,
      status: params.status,
      type: params.type,
      from: params.from,
      to: params.to,
      page: params.page,
      pageSize: params.pageSize,
    });

    const supabase = await createClient();
    let query = supabase
      .from("maintenance_records")
      .select("*, vehicles(id, brand, model, plate, status)", { count: "exact" })
      .order("maintenance_date", { ascending: false });

    if (filters.vehicleId) query = query.eq("vehicle_id", filters.vehicleId);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.from) query = query.gte("maintenance_date", filters.from);
    if (filters.to) query = query.lte("maintenance_date", filters.to);

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw mapPostgresError(error);

    const items = (data ?? []).map((row) => {
      const record = row as MaintenanceRecord & {
        vehicles: MaintenanceWithVehicle["vehicle"];
      };
      return {
        ...record,
        vehicle: record.vehicles,
      };
    });

    return actionSuccess({
      items,
      total: count ?? 0,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / filters.pageSize)),
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getMaintenanceRecord(
  id: string,
): Promise<ActionResult<MaintenanceWithVehicle>> {
  try {
    await assertPermission("maintenance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("maintenance_records")
      .select("*, vehicles(id, brand, model, plate, status)")
      .eq("id", id)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!data) return actionError("Registro no encontrado.");

    const record = data as MaintenanceRecord & {
      vehicles: MaintenanceWithVehicle["vehicle"];
    };

    return actionSuccess({
      ...record,
      vehicle: record.vehicles,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function createMaintenanceRecord(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("maintenance.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const raw = parseMaintenanceForm(formData);
    const parsed = maintenanceSchema.safeParse({
      vehicleId: raw.vehicleId,
      type: raw.type,
      description: raw.description,
      maintenanceDate: raw.maintenanceDate,
      mileage: raw.mileage,
      cost: raw.cost,
      workshop: raw.workshop,
      nextDate: raw.nextDate,
      nextMileage: raw.nextMileage,
      status: raw.status,
      notes: raw.notes,
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("maintenance_records")
      .insert({
        ...maintenanceInputToRow(parsed.data),
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) throw mapPostgresError(error);

    const id = (data as { id: string }).id;

    if (parsed.data.status === "IN_PROGRESS" && raw.setVehicleMaintenance) {
      await syncVehicleStatusAfterMaintenance(
        supabase,
        parsed.data.vehicleId,
        "IN_PROGRESS",
        true,
      );
    }

    await writeAuditLog({
      userId: user.id,
      action: "maintenance.create",
      entityType: "maintenance_record",
      entityId: id,
      metadata: { type: parsed.data.type, status: parsed.data.status },
    });

    revalidatePath("/dashboard/mantenimiento");
    revalidatePath("/dashboard/vehiculos");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function updateMaintenanceRecord(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("maintenance.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const raw = parseMaintenanceForm(formData);
    const parsed = maintenanceUpdateSchema.safeParse({
      vehicleId: raw.vehicleId || undefined,
      type: raw.type || undefined,
      description: raw.description || undefined,
      maintenanceDate: raw.maintenanceDate || undefined,
      mileage: raw.mileage,
      cost: raw.cost || undefined,
      workshop: raw.workshop,
      nextDate: raw.nextDate,
      nextMileage: raw.nextMileage,
      status: raw.status || undefined,
      notes: raw.notes,
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const supabase = await createClient();
    const { data: existing, error: fetchError } = await supabase
      .from("maintenance_records")
      .select("vehicle_id, status")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw mapPostgresError(fetchError);
    if (!existing) return actionError("Registro no encontrado.");

    const row: Record<string, unknown> = {};
    if (parsed.data.vehicleId !== undefined) row.vehicle_id = parsed.data.vehicleId;
    if (parsed.data.type !== undefined) row.type = parsed.data.type;
    if (parsed.data.description !== undefined) row.description = parsed.data.description;
    if (parsed.data.maintenanceDate !== undefined) {
      row.maintenance_date = parsed.data.maintenanceDate;
    }
    if (parsed.data.mileage !== undefined) row.mileage = parsed.data.mileage ?? null;
    if (parsed.data.cost !== undefined) row.cost = parsed.data.cost;
    if (parsed.data.workshop !== undefined) row.workshop = parsed.data.workshop ?? null;
    if (parsed.data.nextDate !== undefined) row.next_date = parsed.data.nextDate ?? null;
    if (parsed.data.nextMileage !== undefined) {
      row.next_mileage = parsed.data.nextMileage ?? null;
    }
    if (parsed.data.status !== undefined) row.status = parsed.data.status;
    if (parsed.data.notes !== undefined) row.notes = parsed.data.notes ?? null;

    const { error } = await supabase
      .from("maintenance_records")
      .update(row)
      .eq("id", id);

    if (error) throw mapPostgresError(error);

    const vehicleId =
      parsed.data.vehicleId ??
      (existing as { vehicle_id: string }).vehicle_id;
    const newStatus =
      parsed.data.status ?? (existing as { status: string }).status;

    if (newStatus === "IN_PROGRESS" && raw.setVehicleMaintenance) {
      await syncVehicleStatusAfterMaintenance(
        supabase,
        vehicleId,
        "IN_PROGRESS",
        true,
      );
    }

    if (newStatus === "COMPLETED") {
      await syncVehicleStatusAfterMaintenance(
        supabase,
        vehicleId,
        "COMPLETED",
      );
    }

    await writeAuditLog({
      userId: user.id,
      action: "maintenance.update",
      entityType: "maintenance_record",
      entityId: id,
      metadata: { status: newStatus },
    });

    revalidatePath("/dashboard/mantenimiento");
    revalidatePath(`/dashboard/mantenimiento/${id}`);
    revalidatePath("/dashboard/vehiculos");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function updateMaintenanceStatus(
  id: string,
  status: string,
  setVehicleMaintenance = false,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("maintenance.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = maintenanceUpdateSchema.shape.status.safeParse(status);
    if (!parsed.success) {
      return actionError("Estado inválido.");
    }

    const supabase = await createClient();
    const { data: existing, error: fetchError } = await supabase
      .from("maintenance_records")
      .select("vehicle_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw mapPostgresError(fetchError);
    if (!existing) return actionError("Registro no encontrado.");

    const { error } = await supabase
      .from("maintenance_records")
      .update({ status: parsed.data })
      .eq("id", id);

    if (error) throw mapPostgresError(error);

    const vehicleId = (existing as { vehicle_id: string }).vehicle_id;

    if (parsed.data === "IN_PROGRESS" && setVehicleMaintenance) {
      await syncVehicleStatusAfterMaintenance(
        supabase,
        vehicleId,
        "IN_PROGRESS",
        true,
      );
    }

    if (parsed.data === "COMPLETED") {
      await syncVehicleStatusAfterMaintenance(
        supabase,
        vehicleId,
        "COMPLETED",
      );
    }

    await writeAuditLog({
      userId: user.id,
      action: "maintenance.status",
      entityType: "maintenance_record",
      entityId: id,
      metadata: { status: parsed.data },
    });

    revalidatePath("/dashboard/mantenimiento");
    revalidatePath(`/dashboard/mantenimiento/${id}`);
    revalidatePath("/dashboard/vehiculos");
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function listMaintenanceVehicles(): Promise<
  ActionResult<Array<{ id: string; label: string }>>
> {
  try {
    await assertPermission("maintenance.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vehicles")
      .select("id, brand, model, plate")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("brand");

    if (error) throw mapPostgresError(error);

    return actionSuccess(
      (data ?? []).map((row) => {
        const v = row as { id: string; brand: string; model: string; plate: string };
        return { id: v.id, label: `${v.brand} ${v.model} (${v.plate})` };
      }),
    );
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
