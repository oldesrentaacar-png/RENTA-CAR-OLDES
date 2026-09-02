"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
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
import { normalizeFormDateTimeToIso } from "@/lib/dates";
import { getDefaultChecklistFromCatalog } from "@/lib/inspections/accessory-catalog";
import {
  DEFAULT_CHECKLIST_ITEMS,
  percentToFuelLevel,
} from "@/lib/inspections/defaults";
import { uploadInspectionPhoto } from "@/lib/storage/private-upload";
import { createClient } from "@/lib/supabase/server";
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

export type InspectionDetail = Inspection & {
  checklist: InspectionChecklistItem[];
  damageMarks: InspectionDamageMark[];
  photos: InspectionPhoto[];
  reservationCode: string;
  customerName: string;
  vehicleLabel: string;
  vehicleModel: string;
  vehicleCategory: string | null;
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

export async function listInspections(
  params: Record<string, string | string[] | undefined> = {},
): Promise<ActionResult<PaginatedResult<Inspection>>> {
  try {
    await assertPermission("inspections.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const filters = inspectionSearchSchema.parse({
      reservationId: params.reservationId,
      vehicleId: params.vehicleId,
      type: params.type,
      page: params.page,
      pageSize: params.pageSize,
    });

    const supabase = await createClient();
    let query = supabase
      .from("inspections")
      .select("*", { count: "exact" })
      .order("inspection_date", { ascending: false });

    if (filters.reservationId) {
      query = query.eq("reservation_id", filters.reservationId);
    }
    if (filters.vehicleId) query = query.eq("vehicle_id", filters.vehicleId);
    if (filters.type) query = query.eq("type", filters.type);

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw mapPostgresError(error);

    return actionSuccess({
      items: ((data ?? []) as InspectionRow[]).map(mapInspectionRow),
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
      "*, customers(first_name, last_name), vehicles(brand, model, year, category), reservations(code)",
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

  return {
    ...inspection,
    checklist: (checklist ?? []).map(mapInspectionChecklistRow),
    damageMarks: (damages ?? []).map(mapInspectionDamageRow),
    photos: (photos ?? []).map(mapInspectionPhotoRow),
    reservationCode: row.reservations.code,
    customerName: `${row.customers.first_name} ${row.customers.last_name}`,
    vehicleLabel: `${row.vehicles.brand} ${row.vehicles.model} ${row.vehicles.year}`,
    vehicleModel: row.vehicles.model,
    vehicleCategory: row.vehicles.category,
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
      .select("id, code, customer_id, vehicle_id, customers(first_name, last_name), vehicles(brand, model, plate)")
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
          | { brand: string; model: string; plate: string }
          | Array<{ brand: string; model: string; plate: string }>;
      };
      const customer = Array.isArray(r.customers) ? r.customers[0] : r.customers;
      const vehicle = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles;
      return {
        id: r.id,
        code: r.code,
        customerId: r.customer_id,
        vehicleId: r.vehicle_id,
        label: `${r.code} — ${customer.first_name} ${customer.last_name} · ${vehicle.brand} ${vehicle.model} (${vehicle.plate})`,
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

    const { data, error } = await supabase
      .from("inspections")
      .insert({
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
      })
      .select("id")
      .single();

    if (error) throw mapPostgresError(error);

    const id = (data as { id: string }).id;

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

    if (checklistError) throw mapPostgresError(checklistError);

    await writeAuditLog({
      userId: user.id,
      action: "inspection.create",
      entityType: "inspection",
      entityId: id,
      metadata: { type: parsed.data.type },
    });

    revalidatePath("/dashboard/inspecciones");
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

    const fuelPercent = formData.get("fuelLevel");
    const row: Record<string, unknown> = {};

    const mileage = formData.get("mileage");
    const notes = formData.get("notes");
    const inspectionDate = formData.get("inspectionDate");

    if (mileage !== null && String(mileage) !== "") {
      row.mileage = Number(mileage);
    }
    if (fuelPercent !== null && String(fuelPercent) !== "") {
      row.fuel_level = percentToFuelLevel(Number(fuelPercent));
    }
    if (notes !== null) row.notes = String(notes).trim() || null;
    if (inspectionDate) {
      row.inspection_date = normalizeFormDateTimeToIso(inspectionDate);
    }

    const supabase = await createClient();
    const { error } = await supabase.from("inspections").update(row).eq("id", id);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "inspection.update",
      entityType: "inspection",
      entityId: id,
    });

    revalidatePath("/dashboard/inspecciones");
    revalidatePath(`/dashboard/inspecciones/${id}`);
    return actionSuccess({ id });
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
      notes: item.notes ?? null,
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
    const { user } = await assertPermission("inspections.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const file = formData.get("file");
    const category = String(formData.get("category") ?? "OTHER");
    const caption = formData.get("caption");

    if (!(file instanceof File) || file.size === 0) {
      return actionError("Archivo requerido.");
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
