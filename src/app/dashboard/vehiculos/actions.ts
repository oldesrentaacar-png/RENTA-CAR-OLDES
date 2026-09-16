"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import {
  mapContractRow,
  mapInspectionRow,
  mapReservationRow,
  mapVehicleImageRow,
  mapVehicleRow,
  vehicleInputToRow,
  type ContractRow,
  type InspectionRow,
  type ReservationRow,
  type VehicleRow,
} from "@/lib/db/mappers";
import {
  isMissingRelationError,
  mapPostgresError,
  toUserMessage,
} from "@/lib/errors";
import { isCloudinaryConfigured, isSupabaseConfigured } from "@/lib/env";
import { asNumber } from "@/lib/safe-number";
import { slugifyVehicle } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import {
  deleteCloudinaryAsset,
  uploadImageFromBuffer,
} from "@/lib/cloudinary/upload";
import type { InspectionWireframeType } from "@/lib/inspections/inspection-wireframe-public";
import { generateVehicleAssetsFromPhoto } from "@/lib/vehicles/generate-views-from-photo";
import { isGeneratedVehicleImage } from "@/lib/vehicles/generated-image";
import {
  vehicleSchema,
  vehicleSearchSchema,
  vehicleUpdateSchema,
} from "@/lib/validation/vehicle";
import type {
  Contract,
  DamageView,
  ExpenseTransaction,
  IncomeTransaction,
  Inspection,
  MaintenanceRecord,
  Reservation,
  Vehicle,
  VehicleImage,
  VehicleMileageHistory,
  VehicleType,
} from "@/types/database";
import type { PaginatedResult } from "@/types/api";

export type VehicleWithImages = Vehicle & { images: VehicleImage[] };

export type VehicleProfileRelated = {
  reservations: Reservation[];
  contracts: Contract[];
  inspections: Inspection[];
  maintenance: MaintenanceRecord[];
  expenses: ExpenseTransaction[];
  incomes: IncomeTransaction[];
  mileageHistory: VehicleMileageHistory[];
  vehicleTypeName: string | null;
  incomeTotal: number;
  expenseTotal: number;
  balance: number;
  catalogReady: boolean;
};

export async function listVehicleTypesOption(): Promise<
  ActionResult<Array<Pick<VehicleType, "id" | "name" | "daily_rate">>>
> {
  try {
    await assertPermission("vehicles.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vehicle_types")
      .select("id, name, daily_rate")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      if (isMissingRelationError(error)) return actionSuccess([]);
      throw mapPostgresError(error);
    }

    return actionSuccess(
      ((data ?? []) as Array<{ id: string; name: string; daily_rate: number }>).map(
        (row) => ({
          id: row.id,
          name: row.name,
          daily_rate: asNumber(row.daily_rate, 0),
        }),
      ),
    );
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getVehicleRelated(
  vehicleId: string,
): Promise<ActionResult<VehicleProfileRelated>> {
  try {
    await assertPermission("vehicles.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const empty: VehicleProfileRelated = {
      reservations: [],
      contracts: [],
      inspections: [],
      maintenance: [],
      expenses: [],
      incomes: [],
      mileageHistory: [],
      vehicleTypeName: null,
      incomeTotal: 0,
      expenseTotal: 0,
      balance: 0,
      catalogReady: true,
    };

    const [
      vehicleRes,
      reservationsRes,
      contractsRes,
      inspectionsRes,
      maintenanceRes,
      expensesRes,
      incomesRes,
      mileageRes,
    ] = await Promise.all([
      supabase
        .from("vehicles")
        .select("*")
        .eq("id", vehicleId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("reservations")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("contracts")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("inspections")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("inspection_date", { ascending: false })
        .limit(50),
      supabase
        .from("maintenance_records")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("maintenance_date", { ascending: false })
        .limit(50),
      supabase
        .from("expense_transactions")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .is("deleted_at", null)
        .order("expense_date", { ascending: false })
        .limit(100),
      supabase
        .from("income_transactions")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false })
        .limit(100),
      supabase
        .from("vehicle_mileage_history")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("recorded_at", { ascending: false })
        .limit(100),
    ]);

    if (reservationsRes.error) throw mapPostgresError(reservationsRes.error);
    if (contractsRes.error) throw mapPostgresError(contractsRes.error);
    if (inspectionsRes.error) throw mapPostgresError(inspectionsRes.error);
    if (maintenanceRes.error) throw mapPostgresError(maintenanceRes.error);
    if (expensesRes.error) throw mapPostgresError(expensesRes.error);
    if (incomesRes.error) throw mapPostgresError(incomesRes.error);

    const mileageHistory: VehicleMileageHistory[] = mileageRes.error
      ? []
      : ((mileageRes.data ?? []) as VehicleMileageHistory[]);

    let vehicleTypeName: string | null = null;
    let catalogReady = true;
    if (mileageRes.error && isMissingRelationError(mileageRes.error)) {
      catalogReady = false;
    }

    const typeId = (
      vehicleRes.data as { vehicle_type_id?: string | null } | null
    )?.vehicle_type_id;

    if (typeId) {
      const { data: typeRow, error: typeError } = await supabase
        .from("vehicle_types")
        .select("name")
        .eq("id", typeId)
        .maybeSingle();
      if (typeError) {
        if (isMissingRelationError(typeError)) catalogReady = false;
      } else {
        vehicleTypeName = (typeRow as { name?: string } | null)?.name ?? null;
      }
    }

    const incomes = (incomesRes.data ?? []) as IncomeTransaction[];
    const expenses = (expensesRes.data ?? []) as ExpenseTransaction[];
    const incomeTotal = incomes.reduce(
      (sum, row) => sum + asNumber(row.amount, 0),
      0,
    );
    const expenseTotal = expenses.reduce(
      (sum, row) => sum + asNumber(row.amount, 0),
      0,
    );

    return actionSuccess({
      ...empty,
      reservations: ((reservationsRes.data ?? []) as ReservationRow[]).map(
        mapReservationRow,
      ),
      contracts: ((contractsRes.data ?? []) as ContractRow[]).map(mapContractRow),
      inspections: ((inspectionsRes.data ?? []) as InspectionRow[]).map(
        mapInspectionRow,
      ),
      maintenance: (maintenanceRes.data ?? []) as MaintenanceRecord[],
      expenses,
      incomes,
      mileageHistory,
      vehicleTypeName,
      incomeTotal,
      expenseTotal,
      balance: incomeTotal - expenseTotal,
      catalogReady,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function listVehicles(
  params: Record<string, string | string[] | undefined> = {},
): Promise<ActionResult<PaginatedResult<Vehicle>>> {
  try {
    await assertPermission("vehicles.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const filters = vehicleSearchSchema.parse({
      query: params.q,
      status: params.status,
      publishedOnWeb: params.published,
      page: params.page,
      pageSize: params.pageSize,
    });

    const supabase = await createClient();
    let query = supabase
      .from("vehicles")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("brand", { ascending: true });

    if (filters.query) {
      const term = `%${filters.query}%`;
      query = query.or(
        `brand.ilike.${term},model.ilike.${term},plate.ilike.${term}`,
      );
    }
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.publishedOnWeb !== undefined) {
      query = query.eq("published_on_web", filters.publishedOnWeb);
    }

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw mapPostgresError(error);

    const items = ((data ?? []) as VehicleRow[]).map(mapVehicleRow);
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

export async function getVehicle(
  id: string,
): Promise<ActionResult<VehicleWithImages>> {
  try {
    await assertPermission("vehicles.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const [{ data: vehicle, error }, { data: images, error: imgError }] =
      await Promise.all([
        supabase
          .from("vehicles")
          .select("*")
          .eq("id", id)
          .is("deleted_at", null)
          .maybeSingle(),
        supabase
          .from("vehicle_images")
          .select("*")
          .eq("vehicle_id", id)
          .order("position", { ascending: true }),
      ]);

    if (error) throw mapPostgresError(error);
    if (imgError) throw mapPostgresError(imgError);
    if (!vehicle) return actionError("Vehículo no encontrado.");

    return actionSuccess({
      ...mapVehicleRow(vehicle as VehicleRow),
      images: (images ?? []).map(mapVehicleImageRow),
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

async function categoryFromVehicleTypeId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vehicleTypeId: string | null | undefined,
  fallbackCategory: string | null | undefined,
): Promise<string> {
  if (vehicleTypeId) {
    const { data } = await supabase
      .from("vehicle_types")
      .select("name")
      .eq("id", vehicleTypeId)
      .maybeSingle();
    if (data?.name?.trim()) return data.name.trim();
  }
  return fallbackCategory?.trim() || "General";
}

export async function createVehicle(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("vehicles.create");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = vehicleSchema.safeParse({
      brand: formData.get("brand"),
      model: formData.get("model"),
      year: formData.get("year"),
      plate: formData.get("plate"),
      vin: formData.get("vin"),
      chassis: formData.get("chassis"),
      engine: formData.get("engine"),
      color: formData.get("color"),
      transmission: formData.get("transmission") || "Automatic",
      fuelType: formData.get("fuelType") || "Gasoline",
      passengers: formData.get("passengers") || 5,
      doors: formData.get("doors") || 4,
      luggage: formData.get("luggage") || 2,
      airConditioning: formData.get("airConditioning") === "on",
      category: formData.get("category"),
      vehicleTypeId: formData.get("vehicleTypeId") || null,
      ownershipType: formData.get("ownershipType") || "OWN",
      dailyRate: formData.get("dailyRate"),
      weeklyRate: formData.get("weeklyRate"),
      deposit: formData.get("deposit") || 0,
      publicDescription: formData.get("publicDescription"),
      ownerName: formData.get("ownerName"),
      ownerPhone: formData.get("ownerPhone"),
      subleaseDailyCost: formData.get("subleaseDailyCost") || undefined,
      subleasePayeeName: formData.get("subleasePayeeName"),
      internalNotes: formData.get("internalNotes"),
      engineOil: formData.get("engineOil"),
      tireInfo: formData.get("tireInfo"),
      currentMileage: formData.get("currentMileage") || undefined,
      status: formData.get("status") || "AVAILABLE",
      publishedOnWeb: formData.get("publishedOnWeb") === "on",
    });

    if (!parsed.success) {
      const message =
        parsed.error.issues
          .map((issue) => issue.message)
          .filter(Boolean)
          .join(" ") || "Datos inválidos.";
      return actionError(message);
    }

    const slug = await ensureUniqueVehicleSlug(
      slugifyVehicle(
        parsed.data.brand,
        parsed.data.model,
        parsed.data.year,
        parsed.data.plate,
      ),
    );

    const supabase = await createClient();
    const category = await categoryFromVehicleTypeId(
      supabase,
      parsed.data.vehicleTypeId,
      parsed.data.category,
    );
    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        ...vehicleInputToRow(parsed.data),
        slug,
        category,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        String((error as { code?: string }).code) === "23505"
      ) {
        return actionError(
          "Ya existe un vehículo con esa placa o identificador.",
        );
      }
      throw mapPostgresError(error);
    }

    const id = (data as { id: string }).id;

    if (parsed.data.publishedOnWeb) {
      await syncPublicVehicleTypeFromUnit(supabase, id, true);
    }

    await writeAuditLog({
      userId: user.id,
      action: "vehicle.create",
      entityType: "vehicle",
      entityId: id,
    });

    revalidatePath("/dashboard/vehiculos");
    if (parsed.data.publishedOnWeb) {
      revalidatePath("/dashboard/configuracion/tipos-vehiculo");
    }
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

async function ensureUniqueVehicleSlug(
  base: string,
  excludeId?: string,
): Promise<string> {
  const supabase = await createClient();
  let candidate = base || `vehicle-${Date.now()}`;
  let attempt = 0;

  while (attempt < 20) {
    let query = supabase
      .from("vehicles")
      .select("id")
      .eq("slug", candidate)
      .limit(1);
    if (excludeId) query = query.neq("id", excludeId);

    const { data, error } = await query;
    if (error) throw mapPostgresError(error);
    if (!data?.length) return candidate;
    attempt += 1;
    candidate = `${base}-${attempt + 1}`;
  }

  return `${base}-${Date.now()}`;
}

export async function updateVehicle(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("vehicles.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = vehicleUpdateSchema.safeParse({
      brand: formData.get("brand") || undefined,
      model: formData.get("model") || undefined,
      year: formData.get("year") || undefined,
      plate: formData.get("plate") || undefined,
      vin: formData.get("vin"),
      chassis: formData.get("chassis"),
      engine: formData.get("engine"),
      color: formData.get("color"),
      transmission: formData.get("transmission"),
      fuelType: formData.get("fuelType"),
      passengers: formData.get("passengers") || undefined,
      doors: formData.get("doors") || undefined,
      luggage: formData.get("luggage") || undefined,
      airConditioning:
        formData.get("airConditioning") === null
          ? undefined
          : formData.get("airConditioning") === "on",
      category: formData.get("category"),
      vehicleTypeId: formData.get("vehicleTypeId") || null,
      ownershipType: formData.get("ownershipType") || undefined,
      dailyRate: formData.get("dailyRate") || undefined,
      weeklyRate: formData.get("weeklyRate"),
      deposit: formData.get("deposit") || undefined,
      publicDescription: formData.get("publicDescription"),
      ownerName: formData.get("ownerName"),
      ownerPhone: formData.get("ownerPhone"),
      subleaseDailyCost: formData.get("subleaseDailyCost") || undefined,
      subleasePayeeName: formData.get("subleasePayeeName"),
      internalNotes: formData.get("internalNotes"),
      engineOil: formData.get("engineOil"),
      tireInfo: formData.get("tireInfo"),
      currentMileage: formData.get("currentMileage") || undefined,
      status: formData.get("status") || undefined,
      publishedOnWeb:
        formData.get("publishedOnWeb") === null
          ? undefined
          : formData.get("publishedOnWeb") === "on",
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const row = vehicleInputToRow(parsed.data);
    if (parsed.data.brand && parsed.data.model && parsed.data.year) {
      const plate = parsed.data.plate;
      if (plate) {
        const desiredSlug = slugifyVehicle(
          parsed.data.brand,
          parsed.data.model,
          parsed.data.year,
          plate,
        );
        row.slug = await ensureUniqueVehicleSlug(desiredSlug, id);
      }
    }

    const supabase = await createClient();
    if (parsed.data.vehicleTypeId) {
      row.category = await categoryFromVehicleTypeId(
        supabase,
        parsed.data.vehicleTypeId,
        parsed.data.category,
      );
    }
    const { error } = await supabase
      .from("vehicles")
      .update(row)
      .eq("id", id)
      .is("deleted_at", null);

    if (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        String((error as { code?: string }).code) === "23505"
      ) {
        return actionError(
          "Ya existe un vehículo con esa placa o identificador. Revise la placa o reactive el registro eliminado.",
        );
      }
      throw mapPostgresError(error);
    }

    if (parsed.data.publishedOnWeb !== undefined) {
      await syncPublicVehicleTypeFromUnit(
        supabase,
        id,
        parsed.data.publishedOnWeb,
      );
    }

    await writeAuditLog({
      userId: user.id,
      action: "vehicle.update",
      entityType: "vehicle",
      entityId: id,
    });

    revalidatePath("/dashboard/vehiculos");
    revalidatePath(`/dashboard/vehiculos/${id}`);
    if (parsed.data.publishedOnWeb !== undefined) {
      revalidatePath("/dashboard/configuracion/tipos-vehiculo");
    }
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function archiveVehicle(id: string): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("vehicles.archive");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();

    const { data: blockingReservations, error: reservationError } = await supabase
      .from("reservations")
      .select("id, code, status")
      .eq("vehicle_id", id)
      .in("status", ["CONFIRMED", "ACTIVE"])
      .is("deleted_at", null)
      .limit(1);

    if (reservationError) throw mapPostgresError(reservationError);
    if (blockingReservations && blockingReservations.length > 0) {
      const code = String(
        (blockingReservations[0] as { code?: string }).code ?? "",
      );
      return actionError(
        code
          ? `No se puede eliminar: tiene la reserva ${code} activa o confirmada. Cancele o finalice esa reserva primero.`
          : "No se puede eliminar: el vehículo tiene reservas activas o confirmadas.",
      );
    }

    const { data: openContracts, error: contractError } = await supabase
      .from("contracts")
      .select("id, code, status")
      .eq("vehicle_id", id)
      .in("status", ["PENDING", "CLIENT_SIGNED", "REPRESENTATIVE_SIGNED"])
      .is("deleted_at", null)
      .limit(1);

    if (contractError) throw mapPostgresError(contractError);
    if (openContracts && openContracts.length > 0) {
      const code = String((openContracts[0] as { code?: string }).code ?? "");
      return actionError(
        code
          ? `No se puede eliminar: tiene el contrato ${code} abierto. Ciérrelo primero.`
          : "No se puede eliminar: el vehículo tiene contratos abiertos.",
      );
    }

    const { data: current, error: currentError } = await supabase
      .from("vehicles")
      .select("id, slug")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (currentError) throw mapPostgresError(currentError);
    if (!current) {
      return actionError("No se encontró el vehículo a eliminar.");
    }

    const currentSlug = String((current as { slug?: string }).slug || "vehicle");
    const freedSlug = `${currentSlug}-deleted-${id.replace(/-/g, "").slice(0, 8)}-${Date.now()}`;

    const { error } = await supabase
      .from("vehicles")
      .update({
        status: "ARCHIVED",
        archived_at: new Date().toISOString(),
        deleted_at: new Date().toISOString(),
        published_on_web: false,
        is_active: false,
        slug: freedSlug,
      })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "vehicle.delete",
      entityType: "vehicle",
      entityId: id,
    });

    revalidatePath("/dashboard/vehiculos");
    revalidatePath(`/dashboard/vehiculos/${id}`);
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

/** Alias claro para la UI: eliminar = soft-delete (no borra historial). */
export async function deleteVehicle(id: string): Promise<ActionResult<void>> {
  return archiveVehicle(id);
}

function slugifyTypeName(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "general"
  );
}

/**
 * Landing shows TYPES + rates only (not plates).
 * Publishing a unit must ensure its type is public, but must NOT overwrite
 * curated catalog fields (rates, copy, images) managed in Tipos de vehículo.
 */
async function syncPublicVehicleTypeFromUnit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vehicleId: string,
  publish: boolean,
): Promise<{ typeName: string | null }> {
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select(
      "id, category, vehicle_type_id, daily_rate, weekly_rate, passengers, luggage, doors, air_conditioning, transmission, public_description, vehicle_images(url, is_primary, position)",
    )
    .eq("id", vehicleId)
    .maybeSingle();

  if (!vehicle) return { typeName: null };

  const category = String(vehicle.category || "").trim() || "General";
  const slug = slugifyTypeName(category);
  let typeId = (vehicle.vehicle_type_id as string | null) ?? null;
  let typeName: string | null = null;
  let typeDeleted = false;
  let typeImageUrl: string | null = null;
  let typeSortOrder = 100;

  if (typeId) {
    const { data: existing } = await supabase
      .from("vehicle_types")
      .select("id, name, deleted_at, image_url, sort_order, is_active")
      .eq("id", typeId)
      .maybeSingle();

    if (existing) {
      typeName = (existing as { name?: string }).name ?? null;
      typeDeleted = Boolean((existing as { deleted_at?: string | null }).deleted_at);
      typeImageUrl =
        ((existing as { image_url?: string | null }).image_url as string | null) ??
        null;
      typeSortOrder = Number(
        (existing as { sort_order?: number | null }).sort_order ?? 100,
      );
      // Soft-deleted type cannot be used for public catalog — unlink and resolve again.
      if (typeDeleted) {
        typeId = null;
        typeName = null;
      }
    } else {
      typeId = null;
    }
  }

  if (!typeId) {
    const { data: bySlug } = await supabase
      .from("vehicle_types")
      .select("id, name, image_url, sort_order")
      .eq("slug", slug)
      .is("deleted_at", null)
      .eq("is_active", true)
      .maybeSingle();

    if (bySlug) {
      typeId = bySlug.id;
      typeName = bySlug.name;
      typeImageUrl =
        ((bySlug as { image_url?: string | null }).image_url as string | null) ??
        null;
      typeSortOrder = Number(
        (bySlug as { sort_order?: number | null }).sort_order ?? 100,
      );
    } else {
      const uniqueSlug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      const { data: created, error: createError } = await supabase
        .from("vehicle_types")
        .insert({
          slug: uniqueSlug,
          name: category,
          name_en: category,
          description: vehicle.public_description,
          daily_rate: Number(vehicle.daily_rate ?? 0),
          weekly_rate:
            vehicle.weekly_rate != null ? Number(vehicle.weekly_rate) : null,
          passengers: Number(vehicle.passengers ?? 5),
          luggage: Number(vehicle.luggage ?? 2),
          doors: Number(vehicle.doors ?? 4),
          air_conditioning: Boolean(vehicle.air_conditioning ?? true),
          transmission: String(vehicle.transmission || "Automatic"),
          published_on_web: publish,
          is_active: true,
          sort_order: 100,
        })
        .select("id, name, image_url, sort_order")
        .single();
      if (createError) throw mapPostgresError(createError);
      typeId = created.id;
      typeName = created.name;
      typeImageUrl =
        ((created as { image_url?: string | null }).image_url as string | null) ??
        null;
      typeSortOrder = 100;
    }

    await supabase
      .from("vehicles")
      .update({ vehicle_type_id: typeId })
      .eq("id", vehicleId);
  }

  if (publish && typeId) {
    const images = (
      (vehicle.vehicle_images as Array<{
        url: string;
        is_primary: boolean;
        position: number;
      }>) ?? []
    )
      .slice()
      .sort(
        (a, b) =>
          Number(b.is_primary) - Number(a.is_primary) || a.position - b.position,
      );
    const unitImageUrl = images[0]?.url ?? null;

    // Auto-created types (sort_order >= 100) may inherit unit snapshot once.
    // Curated catalog types only toggle public visibility (+ fill empty image).
    const isAutoCreated = typeSortOrder >= 100;
    const patch: Record<string, unknown> = {
      published_on_web: true,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (isAutoCreated) {
      patch.daily_rate = Number(vehicle.daily_rate ?? 0);
      patch.weekly_rate =
        vehicle.weekly_rate != null ? Number(vehicle.weekly_rate) : null;
      patch.passengers = Number(vehicle.passengers ?? 5);
      patch.luggage = Number(vehicle.luggage ?? 2);
      patch.doors = Number(vehicle.doors ?? 4);
      patch.air_conditioning = Boolean(vehicle.air_conditioning ?? true);
      patch.transmission = String(vehicle.transmission || "Automatic");
      if (vehicle.public_description) {
        patch.description = vehicle.public_description;
      }
      if (unitImageUrl) patch.image_url = unitImageUrl;
    } else if (!typeImageUrl && unitImageUrl) {
      patch.image_url = unitImageUrl;
    }

    const { error: typeUpdateError } = await supabase
      .from("vehicle_types")
      .update(patch)
      .eq("id", typeId)
      .is("deleted_at", null);

    if (typeUpdateError) throw mapPostgresError(typeUpdateError);
  }
  // Unpublishing / archiving a unit must NEVER hide the catalog type.
  // "Publicar en web" on Tipos de vehículo is the only source of truth for
  // landing visibility (types + rates, not individual plates).

  return { typeName: typeName ?? category };
}

export async function toggleVehiclePublished(
  id: string,
  published: boolean,
): Promise<ActionResult<{ typeName: string | null }>> {
  try {
    const { user } = await assertPermission("vehicles.publish");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("vehicles")
      .update({ published_on_web: published })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw mapPostgresError(error);

    const { typeName } = await syncPublicVehicleTypeFromUnit(
      supabase,
      id,
      published,
    );

    await writeAuditLog({
      userId: user.id,
      action: published ? "vehicle.publish" : "vehicle.unpublish",
      entityType: "vehicle",
      entityId: id,
      metadata: { typeName, published },
    });

    revalidatePath("/dashboard/vehiculos");
    revalidatePath(`/dashboard/vehiculos/${id}`);
    revalidatePath("/dashboard/configuracion/tipos-vehiculo");
    revalidatePath("/api/public/vehicle-types");
    revalidatePath("/landing");
    revalidatePath("/landing/");
    return actionSuccess({ typeName });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function uploadVehicleImage(
  vehicleId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("vehicles.edit");
    if (!isCloudinaryConfigured()) {
      return actionError("Cloudinary no está configurado.");
    }
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return actionError("Seleccione una imagen válida.");
    }

    const viewRaw = formData.get("view");
    const view =
      typeof viewRaw === "string" &&
      ["TOP", "FRONT", "REAR", "LEFT", "RIGHT"].includes(viewRaw)
        ? viewRaw
        : null;

    const buffer = Buffer.from(await file.arrayBuffer());
    const upload = await uploadImageFromBuffer(buffer, {
      folder: `rent-a-car-pro/vehicles/${vehicleId}`,
    });

    if (!upload.ok) {
      return actionError(upload.message);
    }

    const supabase = await createClient();
    const { count } = await supabase
      .from("vehicle_images")
      .select("*", { count: "exact", head: true })
      .eq("vehicle_id", vehicleId);

    const position = count ?? 0;
    const isPrimary = position === 0;

    const { data, error } = await supabase
      .from("vehicle_images")
      .insert({
        vehicle_id: vehicleId,
        url: upload.secureUrl,
        public_id: upload.publicId,
        position,
        is_primary: isPrimary,
        view,
      })
      .select("id")
      .single();

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "vehicle.image.add",
      entityType: "vehicle",
      entityId: vehicleId,
    });

    revalidatePath(`/dashboard/vehiculos/${vehicleId}`);
    return actionSuccess({ id: (data as { id: string }).id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function updateVehicleImageView(
  imageId: string,
  vehicleId: string,
  view: "TOP" | "FRONT" | "REAR" | "LEFT" | "RIGHT" | null,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("vehicles.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("vehicle_images")
      .update({ view })
      .eq("id", imageId)
      .eq("vehicle_id", vehicleId);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "vehicle.image.set_view",
      entityType: "vehicle",
      entityId: vehicleId,
    });

    revalidatePath(`/dashboard/vehiculos/${vehicleId}`);
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function removeVehicleImage(
  imageId: string,
  vehicleId: string,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("vehicles.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data: image, error: fetchError } = await supabase
      .from("vehicle_images")
      .select("public_id, is_primary")
      .eq("id", imageId)
      .eq("vehicle_id", vehicleId)
      .maybeSingle();

    if (fetchError) throw mapPostgresError(fetchError);
    if (!image) return actionError("Imagen no encontrada.");

    if (isCloudinaryConfigured()) {
      await deleteCloudinaryAsset((image as { public_id: string }).public_id);
    }

    const { error } = await supabase
      .from("vehicle_images")
      .delete()
      .eq("id", imageId);

    if (error) throw mapPostgresError(error);

    if ((image as { is_primary: boolean }).is_primary) {
      const { data: remaining } = await supabase
        .from("vehicle_images")
        .select("id")
        .eq("vehicle_id", vehicleId)
        .order("position", { ascending: true })
        .limit(1);

      if (remaining?.[0]) {
        await supabase
          .from("vehicle_images")
          .update({ is_primary: true })
          .eq("id", (remaining[0] as { id: string }).id);
      }
    }

    await writeAuditLog({
      userId: user.id,
      action: "vehicle.image.remove",
      entityType: "vehicle",
      entityId: vehicleId,
    });

    revalidatePath(`/dashboard/vehiculos/${vehicleId}`);
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function setPrimaryVehicleImage(
  imageId: string,
  vehicleId: string,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("vehicles.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    await supabase
      .from("vehicle_images")
      .update({ is_primary: false })
      .eq("vehicle_id", vehicleId);

    const { error } = await supabase
      .from("vehicle_images")
      .update({ is_primary: true })
      .eq("id", imageId)
      .eq("vehicle_id", vehicleId);

    if (error) throw mapPostgresError(error);

    await writeAuditLog({
      userId: user.id,
      action: "vehicle.image.set_primary",
      entityType: "vehicle",
      entityId: vehicleId,
    });

    revalidatePath(`/dashboard/vehiculos/${vehicleId}`);
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function reorderVehicleImages(
  vehicleId: string,
  imageIds: string[],
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("vehicles.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    for (let i = 0; i < imageIds.length; i++) {
      const { error } = await supabase
        .from("vehicle_images")
        .update({ position: i })
        .eq("id", imageIds[i])
        .eq("vehicle_id", vehicleId);
      if (error) throw mapPostgresError(error);
    }

    await writeAuditLog({
      userId: user.id,
      action: "vehicle.image.reorder",
      entityType: "vehicle",
      entityId: vehicleId,
    });

    revalidatePath(`/dashboard/vehiculos/${vehicleId}`);
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

/**
 * Genera el diagrama 2D de 5 vistas (mismo PNG del mapa de daños).
 * Tipo: sedán / pickup / minivan / SUV — forzado por el usuario si hace falta.
 */
export async function generateVehicleViewsFromPhoto(
  vehicleId: string,
  sourceImageId: string,
  wireframeType?: InspectionWireframeType | null,
): Promise<
  ActionResult<{ generatedCount: number; wireframeType: InspectionWireframeType }>
> {
  try {
    const { user } = await assertPermission("vehicles.edit");
    if (!isCloudinaryConfigured()) {
      return actionError("Cloudinary no está configurado.");
    }
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const [
      { data: vehicle, error: vehicleError },
      { data: source, error: sourceError },
    ] = await Promise.all([
      supabase
        .from("vehicles")
        .select(
          "id, brand, model, year, plate, category, vehicle_type_id, vehicle_types(slug, name)",
        )
        .eq("id", vehicleId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("vehicle_images")
        .select("id, url, public_id, view")
        .eq("id", sourceImageId)
        .eq("vehicle_id", vehicleId)
        .maybeSingle(),
    ]);

    if (vehicleError) throw mapPostgresError(vehicleError);
    if (sourceError) throw mapPostgresError(sourceError);
    if (!vehicle) return actionError("Vehículo no encontrado.");
    if (!source) return actionError("Foto de origen no encontrada.");

    const v = vehicle as {
      brand: string;
      model: string;
      year: number;
      plate: string;
      category: string | null;
      vehicle_types:
        | { slug: string; name: string }
        | { slug: string; name: string }[]
        | null;
    };
    const typeRow = Array.isArray(v.vehicle_types)
      ? v.vehicle_types[0]
      : v.vehicle_types;

    const assets = await generateVehicleAssetsFromPhoto({
      category: v.category,
      model: `${v.brand} ${v.model}`,
      typeSlug: typeRow?.slug ?? null,
      typeName: typeRow?.name ?? v.category,
      wireframeType: wireframeType ?? null,
    });

    const { data: existing } = await supabase
      .from("vehicle_images")
      .select("id, public_id, view")
      .eq("vehicle_id", vehicleId);

    for (const row of (existing ?? []) as Array<{
      id: string;
      public_id: string;
      view: DamageView | null;
    }>) {
      if (row.id === sourceImageId) continue;
      if (!isGeneratedVehicleImage(row.public_id)) continue;
      await deleteCloudinaryAsset(row.public_id);
      await supabase.from("vehicle_images").delete().eq("id", row.id);
    }

    const { count } = await supabase
      .from("vehicle_images")
      .select("*", { count: "exact", head: true })
      .eq("vehicle_id", vehicleId);
    const position = count ?? 0;

    const upload = await uploadImageFromBuffer(assets.wireframeDiagram, {
      folder: `rent-a-car-pro/vehicles/${vehicleId}/generated`,
      publicId: `wireframe-2d-${assets.wireframeType.toLowerCase()}-${Date.now()}`,
      tags: [
        "generated",
        "inspection-wireframe-2d",
        `wireframe-${assets.wireframeType}`,
      ],
    });
    if (!upload.ok) return actionError(upload.message);

    const { error: insertError } = await supabase.from("vehicle_images").insert({
      vehicle_id: vehicleId,
      url: upload.secureUrl,
      public_id: upload.publicId,
      position,
      is_primary: false,
      view: "TOP",
    });
    if (insertError) throw mapPostgresError(insertError);

    await writeAuditLog({
      userId: user.id,
      action: "vehicle.image.generate_views",
      entityType: "vehicle",
      entityId: vehicleId,
      metadata: {
        sourceImageId,
        wireframeType: assets.wireframeType,
        wireframeLabel: assets.wireframeLabel,
        kind: "inspection-wireframe-2d",
      },
    });

    revalidatePath(`/dashboard/vehiculos/${vehicleId}`);
    return actionSuccess({
      generatedCount: 1,
      wireframeType: assets.wireframeType,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
