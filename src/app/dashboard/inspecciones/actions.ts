"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertAnyPermission, assertPermission } from "@/lib/auth/guards";
import {
  mapInspectionChecklistRow,
  mapInspectionDamageRow,
  mapInspectionPhotoRow,
  mapInspectionRow,
  mapReservationRow,
  type InspectionRow,
  type ReservationRow,
} from "@/lib/db/mappers";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { formatVehicleLabel } from "@/lib/vehicles/label";
import { applyVehicleMileage } from "@/lib/vehicles/mileage";
import { mergeObservationTexts } from "@/lib/contracts/observations";
import { normalizeFormDateTimeToIso } from "@/lib/dates";
import { getDefaultChecklistFromCatalog } from "@/lib/inspections/accessory-catalog";
import {
  DEFAULT_CHECKLIST_ITEMS,
} from "@/lib/inspections/defaults";
import {
  INSPECTION_PHOTOS_BUCKET,
  deletePrivateObject,
  resolvePrivateFileUrl,
  uploadInspectionPhoto,
} from "@/lib/storage/private-upload";
import { createClient } from "@/lib/supabase/server";
import { firstRelation } from "@/lib/validation/form-helpers";
import {
  checklistItemSchema,
  damageMarkSchema,
  inspectionSchema,
  inspectionSearchSchema,
} from "@/lib/validation/inspection";
import type {
  Inspection,
  InspectionChecklistItem,
  InspectionDamageMark,
  InspectionPhoto,
  InspectionType,
} from "@/types/database";
import type { PaginatedResult } from "@/types/api";

async function revalidateContractsLinkedToInspection(
  inspectionId: string,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  const { data: inspection } = await supabase
    .from("inspections")
    .select("reservation_id")
    .eq("id", inspectionId)
    .maybeSingle();

  const reservationId = (inspection as { reservation_id?: string | null } | null)
    ?.reservation_id;
  if (!reservationId) return;

  const { data: contracts } = await supabase
    .from("contracts")
    .select("id")
    .eq("reservation_id", reservationId)
    .is("deleted_at", null);

  const now = new Date().toISOString();
  const ids = ((contracts ?? []) as Array<{ id: string }>).map((row) => row.id);
  if (ids.length > 0) {
    await supabase
      .from("contracts")
      .update({ updated_at: now })
      .in("id", ids);
  }

  revalidatePath("/dashboard/contratos");
  for (const id of ids) {
    revalidatePath(`/dashboard/contratos/${id}`);
    revalidatePath(`/dashboard/contratos/${id}/pdf`);
    revalidatePath(`/dashboard/contratos/${id}/acta-cierre/pdf`);
  }
}

export type InspectionDetail = Inspection & {
  checklist: InspectionChecklistItem[];
  damageMarks: InspectionDamageMark[];
  photos: InspectionPhoto[];
  reservationCode: string;
  customerName: string;
  vehicleLabel: string;
  vehicleModel: string;
  vehicleCategory: string | null;
  vehicleTypeSlug: string | null;
  vehicleTypeName: string | null;
  vehiclePhotoUrl: string | null;
  viewPhotos: Partial<
    Record<"TOP" | "FRONT" | "REAR" | "LEFT" | "RIGHT", string>
  >;
};

export type InspectionComparison = {
  reservationId: string;
  checkOut: InspectionDetail | null;
  checkIn: InspectionDetail | null;
  newDamages: InspectionDamageMark[];
  changedChecklist: Array<{
    itemName: string;
    checkOutStatus: string;
    checkInStatus: string;
  }>;
};

export type InspectionListItem = Inspection & {
  vehicleLabel: string;
  vehiclePlate: string | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
};

export type InspectionVehicleFilterOption = {
  id: string;
  label: string;
};

export async function listVehiclesForInspectionFilter(): Promise<
  ActionResult<InspectionVehicleFilterOption[]>
> {
  try {
    await assertPermission("inspections.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vehicles")
      .select("id, brand, model, year, plate")
      .is("deleted_at", null)
      .order("brand", { ascending: true })
      .order("model", { ascending: true })
      .order("plate", { ascending: true })
      .limit(500);

    if (error) throw mapPostgresError(error);

    const items = ((data ?? []) as Array<{
      id: string;
      brand: string | null;
      model: string | null;
      year: number | null;
      plate: string | null;
    }>).map((row) => ({
      id: row.id,
      label: formatVehicleLabel(row, { includeBrand: true }),
    }));

    return actionSuccess(items);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function listInspections(
  params: Record<string, string | string[] | undefined> = {},
): Promise<ActionResult<PaginatedResult<InspectionListItem>>> {
  try {
    await assertPermission("inspections.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const filters = inspectionSearchSchema.parse({
      query: params.q,
      reservationId: params.reservationId,
      vehicleId: params.vehicleId,
      type: params.type ?? params.status,
      page: params.page,
      pageSize: params.pageSize,
    });

    const supabase = await createClient();
    let query = supabase
      .from("inspections")
      .select(
        "*, vehicles(brand, model, year, plate)",
        { count: "exact" },
      )
      .order("inspection_date", { ascending: false });

    if (filters.reservationId) {
      query = query.eq("reservation_id", filters.reservationId);
    }
    if (filters.vehicleId) query = query.eq("vehicle_id", filters.vehicleId);
    if (filters.type) query = query.eq("type", filters.type);

    if (filters.query) {
      const term = filters.query
        .trim()
        .replace(/[,()]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (term) {
        const like = `%${term}%`;
        // Prioridad operativa: vehículo (placa/marca/modelo) y código de inspección.
        const { data: matchingVehicles } = await supabase
          .from("vehicles")
          .select("id")
          .or(`plate.ilike.${like},brand.ilike.${like},model.ilike.${like}`)
          .limit(100);

        const vehicleIds = (matchingVehicles ?? []).map(
          (row) => (row as { id: string }).id,
        );

        const orParts = [`code.ilike.${like}`];
        if (vehicleIds.length > 0) {
          orParts.push(`vehicle_id.in.(${vehicleIds.join(",")})`);
        }
        query = query.or(orParts.join(","));
      }
    }

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw mapPostgresError(error);

    type VehicleJoin = {
      brand: string | null;
      model: string | null;
      year: number | null;
      plate: string | null;
    };

    const items: InspectionListItem[] = (
      (data ?? []) as Array<
        InspectionRow & {
          vehicles: VehicleJoin | VehicleJoin[] | null;
        }
      >
    ).map((row) => {
      const vehicle = firstRelation(row.vehicles);
      const mapped = mapInspectionRow(row);
      return {
        ...mapped,
        vehicleBrand: vehicle?.brand ?? null,
        vehicleModel: vehicle?.model ?? null,
        vehicleYear: vehicle?.year ?? null,
        vehiclePlate: vehicle?.plate ?? null,
        vehicleLabel: formatVehicleLabel(vehicle, { includeBrand: true }),
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

async function loadInspectionDetail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<InspectionDetail | null> {
  const { data, error } = await supabase
    .from("inspections")
    .select(
      "*, customers(first_name, last_name), vehicles(brand, model, year, plate, category, vehicle_type_id, vehicle_types(slug, name)), reservations(code)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw mapPostgresError(error);
  if (!data) return null;

  const row = data as InspectionRow & {
    customers: { first_name: string; last_name: string };
    vehicles: {
      brand: string;
      model: string;
      year: number;
      category: string | null;
      vehicle_type_id: string | null;
      vehicle_types: { slug: string; name: string } | { slug: string; name: string }[] | null;
    };
    reservations: { code: string };
  };

  const inspection = mapInspectionRow(row);

  const [{ data: checklist }, { data: damages }, { data: photos }, { data: vehicleImages }] =
    await Promise.all([
      supabase
        .from("inspection_checklist_items")
        .select("*")
        .eq("inspection_id", id)
        .order("sort_order"),
      supabase
        .from("inspection_damage_marks")
        .select("*")
        .eq("inspection_id", id)
        .order("mark_number"),
      supabase
        .from("inspection_photos")
        .select("*")
        .eq("inspection_id", id)
        .order("created_at"),
      supabase
        .from("vehicle_images")
        .select("url, view, is_primary, position")
        .eq("vehicle_id", inspection.vehicle_id)
        .order("position", { ascending: true }),
    ]);

  const viewPhotos: InspectionDetail["viewPhotos"] = {};
  let vehiclePhotoUrl: string | null = null;
  for (const image of (vehicleImages ?? []) as Array<{
    url: string;
    view: "TOP" | "FRONT" | "REAR" | "LEFT" | "RIGHT" | null;
    is_primary: boolean;
  }>) {
    if (image.is_primary && !vehiclePhotoUrl) vehiclePhotoUrl = image.url;
    if (image.view && !viewPhotos[image.view]) {
      viewPhotos[image.view] = image.url;
    }
  }
  if (!vehiclePhotoUrl && vehicleImages?.[0]) {
    vehiclePhotoUrl = (vehicleImages[0] as { url: string }).url;
  }

  const vehicleType = Array.isArray(row.vehicles.vehicle_types)
    ? row.vehicles.vehicle_types[0]
    : row.vehicles.vehicle_types;

  const photoRows = (photos ?? []) as Array<{
    id: string;
    inspection_id: string;
    category: InspectionPhoto["category"];
    storage_path: string;
    file_name: string | null;
    caption: string | null;
    created_at: string;
  }>;

  const photosWithUrl: InspectionPhoto[] = await Promise.all(
    photoRows.map(async (photo) => {
      const mapped = mapInspectionPhotoRow(photo);
      const url = await resolvePrivateFileUrl(photo.storage_path, 3600, {
        bucket: INSPECTION_PHOTOS_BUCKET,
      });
      return { ...mapped, url };
    }),
  );

  return {
    ...inspection,
    checklist: (checklist ?? []).map(mapInspectionChecklistRow),
    damageMarks: (damages ?? []).map(mapInspectionDamageRow),
    photos: photosWithUrl,
    reservationCode: row.reservations.code,
    customerName: `${row.customers.first_name} ${row.customers.last_name}`,
    vehicleLabel: formatVehicleLabel(row.vehicles),
    vehicleModel: row.vehicles.model,
    vehicleCategory: row.vehicles.category,
    vehicleTypeSlug: vehicleType?.slug ?? null,
    vehicleTypeName: vehicleType?.name ?? null,
    vehiclePhotoUrl,
    viewPhotos,
  };
}

export async function getInspection(
  id: string,
): Promise<ActionResult<InspectionDetail>> {
  try {
    await assertPermission("inspections.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const detail = await loadInspectionDetail(supabase, id);
    if (!detail) return actionError("Inspección no encontrada.");

    return actionSuccess(detail);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getReservationOptionsForInspection(): Promise<
  ActionResult<
    Array<{
      id: string;
      code: string;
      customerId: string;
      vehicleId: string;
      label: string;
    }>
  >
> {
  try {
    await assertPermission("inspections.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reservations")
      .select("id, code, customer_id, vehicle_id, customers(first_name, last_name), vehicles(brand, model, year, plate)")
      .is("deleted_at", null)
      .in("status", ["CONFIRMED", "ACTIVE", "COMPLETED"])
      .order("start_at", { ascending: false })
      .limit(100);

    if (error) throw mapPostgresError(error);

    const items = (data ?? []).map((row) => {
      const r = row as {
        id: string;
        code: string;
        customer_id: string;
        vehicle_id: string;
        customers:
          | { first_name: string; last_name: string }
          | Array<{ first_name: string; last_name: string }>;
        vehicles:
          | { brand: string; model: string; year: number; plate: string }
          | Array<{ brand: string; model: string; year: number; plate: string }>;
      };
      const customer = Array.isArray(r.customers) ? r.customers[0] : r.customers;
      const vehicle = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles;
      return {
        id: r.id,
        code: r.code,
        customerId: r.customer_id,
        vehicleId: r.vehicle_id,
        label: `${r.code} — ${customer.first_name} ${customer.last_name} · ${formatVehicleLabel(vehicle)}`,
      };
    });

    return actionSuccess(items);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function createInspection(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("inspections.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const fuelLevelRaw = formData.get("fuelLevel");
    const fuelLevel =
      fuelLevelRaw != null && String(fuelLevelRaw).trim() !== ""
        ? String(fuelLevelRaw)
        : undefined;

    const rawDate = formData.get("inspectionDate");
    const inspectionDate =
      rawDate && String(rawDate).trim() !== ""
        ? normalizeFormDateTimeToIso(rawDate)
        : new Date().toISOString();

    const parsed = inspectionSchema.safeParse({
      reservationId: formData.get("reservationId"),
      vehicleId: formData.get("vehicleId"),
      customerId: formData.get("customerId"),
      type: formData.get("type"),
      inspectionDate,
      mileage: formData.get("mileage"),
      fuelLevel,
      handoverPersonName: formData.get("handoverPersonName"),
      additionalDriverName: formData.get("additionalDriverName"),
      notes: formData.get("notes"),
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const supabase = await createClient();

    const { data: existingInspection } = await supabase
      .from("inspections")
      .select("id, code")
      .eq("reservation_id", parsed.data.reservationId)
      .eq("type", parsed.data.type)
      .maybeSingle();

    if (existingInspection) {
      const code = (existingInspection as { code: string }).code;
      return actionError(
        `Ya existe una inspección ${parsed.data.type === "CHECK_IN" ? "de entrada" : "de salida"} (${code}) para esta reserva.`,
      );
    }

    // Pareja A/B: misma secuencia — A = salida (CHECK_OUT), B = entrada (CHECK_IN).
    let presetCode: string | null = null;
    if (parsed.data.type === "CHECK_IN") {
      const { data: checkOut } = await supabase
        .from("inspections")
        .select("code")
        .eq("reservation_id", parsed.data.reservationId)
        .eq("type", "CHECK_OUT")
        .maybeSingle();
      const checkOutCode = (checkOut as { code?: string } | null)?.code?.trim();
      if (checkOutCode) {
        const base = checkOutCode.replace(/[AB]$/i, "");
        presetCode = `${base}B`;
      }
    }

    const insertRow: Record<string, unknown> = {
      reservation_id: parsed.data.reservationId,
      vehicle_id: parsed.data.vehicleId,
      customer_id: parsed.data.customerId,
      type: parsed.data.type,
      inspection_date: parsed.data.inspectionDate,
      mileage: parsed.data.mileage ?? null,
      fuel_level: parsed.data.fuelLevel ?? null,
      handover_person_name: parsed.data.handoverPersonName ?? null,
      additional_driver_name: parsed.data.additionalDriverName ?? null,
      notes: parsed.data.notes ?? null,
      created_by: user.id,
    };
    if (presetCode) insertRow.code = presetCode;

    const { data, error } = await supabase
      .from("inspections")
      .insert(insertRow)
      .select("id, code")
      .single();

    if (error) throw mapPostgresError(error);

    const id = (data as { id: string; code: string }).id;
    let code = (data as { code: string }).code;

    if (parsed.data.type === "CHECK_OUT" && code && !/[AB]$/i.test(code)) {
      const withA = `${code}A`;
      const { error: codeError } = await supabase
        .from("inspections")
        .update({ code: withA })
        .eq("id", id);
      if (!codeError) code = withA;
    }

    const checklistDefaults =
      (await getDefaultChecklistFromCatalog()) ?? DEFAULT_CHECKLIST_ITEMS;
    const checklistRows = checklistDefaults.map((item, index) => ({
      inspection_id: id,
      item_name: item.label,
      status: item.status,
      sort_order: index,
    }));

    const { error: checklistError } = await supabase
      .from("inspection_checklist_items")
      .insert(checklistRows);

    if (checklistError) {
      // Compensa inspección huérfana si falla el checklist (permiso/RLS).
      await supabase.from("inspections").delete().eq("id", id);
      throw mapPostgresError(checklistError);
    }

    if (parsed.data.type === "CHECK_OUT") {
      await supabase
        .from("reservations")
        .update({ status: "ACTIVE" })
        .eq("id", parsed.data.reservationId)
        .eq("status", "CONFIRMED")
        .is("deleted_at", null);
    }

    if (parsed.data.mileage != null) {
      await applyVehicleMileage(supabase, {
        vehicleId: parsed.data.vehicleId,
        mileage: parsed.data.mileage,
        source: parsed.data.type,
        userId: user.id,
        inspectionId: id,
        notes: `Inspección ${parsed.data.type}`,
      });
    }

    await writeAuditLog({
      userId: user.id,
      action: "inspection.create",
      entityType: "inspection",
      entityId: id,
      metadata: { type: parsed.data.type },
    });

    revalidatePath("/dashboard/inspecciones");
    revalidatePath(`/dashboard/vehiculos/${parsed.data.vehicleId}`);
    revalidatePath("/dashboard/vehiculos");
    revalidatePath("/dashboard/alertas");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function updateInspection(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("inspections.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const fuelLevelRaw = formData.get("fuelLevel");
    const fuelLevel =
      fuelLevelRaw != null && String(fuelLevelRaw).trim() !== ""
        ? String(fuelLevelRaw)
        : undefined;

    const mileageRaw = formData.get("mileage");
    const notesRaw = formData.get("notes");
    const inspectionDateRaw = formData.get("inspectionDate");
    const handoverRaw = formData.get("handoverPersonName");
    const additionalDriverRaw = formData.get("additionalDriverName");

    if (!inspectionDateRaw || String(inspectionDateRaw).trim() === "") {
      return actionError("Fecha de inspección requerida.");
    }

    const FUEL_LEVELS = new Set([
      "EMPTY",
      "ONE_EIGHTH",
      "QUARTER",
      "THREE_EIGHTHS",
      "HALF",
      "FIVE_EIGHTHS",
      "THREE_QUARTERS",
      "SEVEN_EIGHTHS",
      "FULL",
    ]);

    let fuel_level: string | null = null;
    if (fuelLevel) {
      if (!FUEL_LEVELS.has(fuelLevel)) {
        return actionError("Nivel de combustible inválido.");
      }
      fuel_level = fuelLevel;
    }

    let mileage: number | null = null;
    if (mileageRaw !== null && String(mileageRaw).trim() !== "") {
      const n = Number(mileageRaw);
      if (!Number.isInteger(n) || n < 0 || n > 9_999_999) {
        return actionError("Kilometraje inválido.");
      }
      mileage = n;
    }

    if (mileage == null) {
      return actionError("El kilometraje es obligatorio.");
    }
    if (!fuel_level) {
      return actionError("El nivel de combustible es obligatorio.");
    }

    const row = {
      inspection_date: normalizeFormDateTimeToIso(inspectionDateRaw),
      mileage,
      fuel_level,
      handover_person_name:
        handoverRaw != null ? String(handoverRaw).trim() || null : null,
      additional_driver_name:
        additionalDriverRaw != null
          ? String(additionalDriverRaw).trim() || null
          : null,
      notes: notesRaw != null ? String(notesRaw).trim() || null : null,
    };

    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase
      .from("inspections")
      .select("id, vehicle_id, type")
      .eq("id", id)
      .maybeSingle();

    if (existingError) throw mapPostgresError(existingError);
    if (!existing) return actionError("Inspección no encontrada.");

    const existingRow = existing as {
      id: string;
      vehicle_id: string;
      type: InspectionType;
    };

    const { error } = await supabase.from("inspections").update(row).eq("id", id);

    if (error) throw mapPostgresError(error);

    await applyVehicleMileage(supabase, {
      vehicleId: existingRow.vehicle_id,
      mileage,
      source: existingRow.type,
      userId: user.id,
      inspectionId: id,
      notes: `Actualización inspección ${existingRow.type}`,
    });

    await writeAuditLog({
      userId: user.id,
      action: "inspection.update",
      entityType: "inspection",
      entityId: id,
    });

    revalidatePath("/dashboard/inspecciones");
    revalidatePath(`/dashboard/inspecciones/${id}`);
    revalidatePath(`/dashboard/inspecciones/${id}/edit`);
    revalidatePath(`/dashboard/vehiculos/${existingRow.vehicle_id}`);
    revalidatePath("/dashboard/vehiculos");
    revalidatePath("/dashboard/alertas");
    await revalidateContractsLinkedToInspection(id);
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function deleteInspection(
  id: string,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("inspections.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase
      .from("inspections")
      .select("id, code, reservation_id")
      .eq("id", id)
      .maybeSingle();

    if (existingError) throw mapPostgresError(existingError);
    if (!existing) {
      return actionError("No se encontró la inspección a eliminar.");
    }

    const reservationId = (existing as { reservation_id: string }).reservation_id;
    const code = (existing as { code: string }).code;

    // Touch linked contracts before delete so UI caches refresh after CASCADE.
    await revalidateContractsLinkedToInspection(id);

    const { error } = await supabase.from("inspections").delete().eq("id", id);
    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "inspection.delete",
      entityType: "inspection",
      entityId: id,
      metadata: { code, reservationId },
    });

    revalidatePath("/dashboard/inspecciones");
    revalidatePath(`/dashboard/inspecciones/${id}`);
    revalidatePath(`/dashboard/inspecciones/${id}/edit`);
    if (reservationId) {
      revalidatePath(
        `/dashboard/inspecciones/${id}/comparar?reservation_id=${reservationId}`,
      );
    }
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function saveInspectionGeneralNotes(
  inspectionId: string,
  notes: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("inspections.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase
      .from("inspections")
      .select("id, type, reservation_id")
      .eq("id", inspectionId)
      .maybeSingle();
    if (existingError) throw mapPostgresError(existingError);
    if (!existing) return actionError("Inspección no encontrada.");

    const existingRow = existing as {
      id: string;
      type: string;
      reservation_id: string;
    };
    const trimmedNotes = notes.trim() || null;

    const { error } = await supabase
      .from("inspections")
      .update({
        notes: trimmedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inspectionId);
    if (error) throw mapPostgresError(error);

    // Las observaciones de salida alimentan la sección 4 del PDF del contrato.
    if (existingRow.type === "CHECK_OUT" && existingRow.reservation_id) {
      const { data: contracts } = await supabase
        .from("contracts")
        .select("id, notes")
        .eq("reservation_id", existingRow.reservation_id)
        .is("deleted_at", null);

      for (const contract of (contracts ?? []) as Array<{
        id: string;
        notes: string | null;
      }>) {
        const merged = mergeObservationTexts(contract.notes, trimmedNotes);
        await supabase
          .from("contracts")
          .update({
            notes: merged || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", contract.id);
        revalidatePath(`/dashboard/contratos/${contract.id}`);
        revalidatePath(`/dashboard/contratos/${contract.id}/pdf`);
      }
    }

    await writeAuditLog({
      userId: user.id,
      action: "inspection.notes",
      entityType: "inspection",
      entityId: inspectionId,
    });

    revalidatePath(`/dashboard/inspecciones/${inspectionId}`);
    await revalidateContractsLinkedToInspection(inspectionId);
    return actionSuccess({ id: inspectionId });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function saveChecklistItems(
  inspectionId: string,
  itemsJson: string,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("inspections.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    let rawItems: unknown[];
    try {
      rawItems = JSON.parse(itemsJson) as unknown[];
    } catch {
      return actionError("Formato de checklist inválido.");
    }

    const items: z.infer<typeof checklistItemSchema>[] = [];
    for (let index = 0; index < rawItems.length; index++) {
      const parsed = checklistItemSchema.safeParse({
        ...(rawItems[index] as object),
        sortOrder: index,
      });
      if (!parsed.success) {
        return actionError(
          parsed.error.issues[0]?.message ??
            `Ítem ${index + 1} del checklist inválido.`,
        );
      }
      items.push(parsed.data);
    }

    const supabase = await createClient();
    await supabase
      .from("inspection_checklist_items")
      .delete()
      .eq("inspection_id", inspectionId);

    const rows = items.map((item, index) => ({
      inspection_id: inspectionId,
      item_name: item.label,
      status: item.status,
      // Per-item notes removed from UI; only general inspection notes are used.
      notes: null,
      sort_order: index,
    }));

    const { error } = await supabase
      .from("inspection_checklist_items")
      .insert(rows);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "inspection.checklist.save",
      entityType: "inspection",
      entityId: inspectionId,
    });

    revalidatePath(`/dashboard/inspecciones/${inspectionId}`);
    await revalidateContractsLinkedToInspection(inspectionId);
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function saveDamageMarks(
  inspectionId: string,
  marksJson: string,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("inspections.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    let rawMarks: unknown[];
    try {
      rawMarks = JSON.parse(marksJson) as unknown[];
    } catch {
      return actionError("Formato de daños inválido.");
    }

    const marks: Array<
      z.infer<typeof damageMarkSchema> & { markNumber: number }
    > = [];
    for (let index = 0; index < rawMarks.length; index++) {
      const parsed = damageMarkSchema.safeParse(rawMarks[index]);
      if (!parsed.success) {
        return actionError(
          parsed.error.issues[0]?.message ??
            `Marca de daño ${index + 1} inválida.`,
        );
      }
      marks.push({ ...parsed.data, markNumber: index + 1 });
    }

    const supabase = await createClient();
    await supabase
      .from("inspection_damage_marks")
      .delete()
      .eq("inspection_id", inspectionId);

    if (marks.length > 0) {
      const rows = marks.map((mark, index) => ({
        inspection_id: inspectionId,
        view: mark.view,
        x: mark.x,
        y: mark.y,
        damage_type: mark.damageType,
        severity: mark.severity,
        description: mark.description ?? null,
        photo_id: mark.photoId ?? null,
        mark_number: index + 1,
        path_points:
          mark.pathPoints && mark.pathPoints.length >= 2
            ? mark.pathPoints
            : null,
      }));

      const { error } = await supabase
        .from("inspection_damage_marks")
        .insert(rows);

      if (error) throw mapPostgresError(error);
    }

    await writeAuditLog({
      userId: user.id,
      action: "inspection.damages.save",
      entityType: "inspection",
      entityId: inspectionId,
    });

    revalidatePath(`/dashboard/inspecciones/${inspectionId}`);
    await revalidateContractsLinkedToInspection(inspectionId);
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function uploadInspectionPhotoAction(
  inspectionId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; warning?: string }>> {
  try {
    const { user } = await assertAnyPermission([
      "inspections.edit",
      "inspections.create",
    ]);
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const file = formData.get("file");
    const category = String(formData.get("category") ?? "OTHER");
    const caption = formData.get("caption");

    if (!(file instanceof File) || file.size === 0) {
      return actionError("Archivo requerido.");
    }
    if (!file.type.startsWith("image/")) {
      return actionError("Solo se permiten imágenes.");
    }
    if (file.size > 12 * 1024 * 1024) {
      return actionError("Cada foto debe pesar menos de 12 MB.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const upload = await uploadInspectionPhoto(
      inspectionId,
      file.name,
      buffer,
      file.type || "image/jpeg",
    );

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("inspection_photos")
      .insert({
        inspection_id: inspectionId,
        category,
        storage_path: upload.storagePath,
        file_name: file.name,
        caption: caption ? String(caption) : null,
      })
      .select("id")
      .single();

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "inspection.photo.upload",
      entityType: "inspection",
      entityId: inspectionId,
    });

    revalidatePath(`/dashboard/inspecciones/${inspectionId}`);
    return actionSuccess({
      id: (data as { id: string }).id,
      warning: upload.warning,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function deleteInspectionPhotoAction(
  inspectionId: string,
  photoId: string,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertAnyPermission([
      "inspections.edit",
      "inspections.create",
    ]);
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }
    if (!photoId) return actionError("Foto no válida.");

    const supabase = await createClient();
    const { data: photo, error: loadError } = await supabase
      .from("inspection_photos")
      .select("id, storage_path, inspection_id")
      .eq("id", photoId)
      .eq("inspection_id", inspectionId)
      .maybeSingle();

    if (loadError) throw mapPostgresError(loadError);
    if (!photo) return actionError("Foto no encontrada.");

    const storagePath = String(
      (photo as { storage_path?: string }).storage_path ?? "",
    );

    // Clear optional damage-mark links before deleting the photo row.
    await supabase
      .from("inspection_damage_marks")
      .update({ photo_id: null })
      .eq("photo_id", photoId);

    const { error: deleteError } = await supabase
      .from("inspection_photos")
      .delete()
      .eq("id", photoId)
      .eq("inspection_id", inspectionId);

    if (deleteError) throw mapPostgresError(deleteError);

    try {
      await deletePrivateObject(storagePath, {
        bucket: INSPECTION_PHOTOS_BUCKET,
      });
    } catch (storageErr) {
      console.error(
        "[deleteInspectionPhotoAction] storage",
        storageErr instanceof Error ? storageErr.message : storageErr,
      );
    }

    await writeAuditLog({
      userId: user.id,
      action: "inspection.photo.delete",
      entityType: "inspection",
      entityId: inspectionId,
      metadata: { photoId },
    });

    revalidatePath(`/dashboard/inspecciones/${inspectionId}`);
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getInspectionComparison(
  reservationId: string,
): Promise<ActionResult<InspectionComparison>> {
  try {
    await assertPermission("inspections.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("inspections")
      .select("id, type")
      .eq("reservation_id", reservationId);

    if (error) throw mapPostgresError(error);

    const rows = (data ?? []) as Array<{ id: string; type: InspectionType }>;
    const checkOutId = rows.find((r) => r.type === "CHECK_OUT")?.id;
    const checkInId = rows.find((r) => r.type === "CHECK_IN")?.id;

    const checkOut = checkOutId
      ? await loadInspectionDetail(supabase, checkOutId)
      : null;
    const checkIn = checkInId
      ? await loadInspectionDetail(supabase, checkInId)
      : null;

    const checkOutDamageKeys = new Set(
      (checkOut?.damageMarks ?? []).map(
        (m) => `${m.view}:${Math.round(m.x * 100)}:${Math.round(m.y * 100)}:${m.damage_type}`,
      ),
    );

    const newDamages = (checkIn?.damageMarks ?? []).filter((m) => {
      const key = `${m.view}:${Math.round(m.x * 100)}:${Math.round(m.y * 100)}:${m.damage_type}`;
      return !checkOutDamageKeys.has(key);
    });

    const checkOutChecklist = new Map(
      (checkOut?.checklist ?? []).map((item) => [item.item_name, item.status]),
    );

    const changedChecklist = (checkIn?.checklist ?? [])
      .filter((item) => {
        const outStatus = checkOutChecklist.get(item.item_name);
        return outStatus && outStatus !== item.status;
      })
      .map((item) => ({
        itemName: item.item_name,
        checkOutStatus: checkOutChecklist.get(item.item_name) ?? "—",
        checkInStatus: item.status,
      }));

    return actionSuccess({
      reservationId,
      checkOut,
      checkIn,
      newDamages,
      changedChecklist,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getPrefillFromReservation(
  reservationId: string,
): Promise<ActionResult<ReturnType<typeof mapReservationRow>>> {
  try {
    await assertPermission("inspections.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", reservationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw mapPostgresError(error);
    if (!data) return actionError("Reserva no encontrada.");

    return actionSuccess(mapReservationRow(data as ReservationRow));
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
