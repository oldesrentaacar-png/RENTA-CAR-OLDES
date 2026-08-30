"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import {
  isMissingRelationError,
  mapPostgresError,
  toUserMessage,
} from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import {
  vehicleTypeSchema,
  vehicleTypeUpdateSchema,
} from "@/lib/validation/vehicle-type";
import type { VehicleType } from "@/types/database";

function mapVehicleTypeRow(row: Record<string, unknown>): VehicleType {
  const featuresRaw = row.features;
  const features = Array.isArray(featuresRaw)
    ? featuresRaw.map(String)
    : [];

  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    name_en: (row.name_en as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    description_en: (row.description_en as string | null) ?? null,
    reference_models: (row.reference_models as string | null) ?? null,
    reference_models_en: (row.reference_models_en as string | null) ?? null,
    daily_rate: Number(row.daily_rate),
    weekly_rate: row.weekly_rate != null ? Number(row.weekly_rate) : null,
    passengers: Number(row.passengers ?? 5),
    luggage: Number(row.luggage ?? 2),
    luggage_label: (row.luggage_label as string | null) ?? null,
    luggage_label_en: (row.luggage_label_en as string | null) ?? null,
    doors: Number(row.doors ?? 4),
    air_conditioning: Boolean(row.air_conditioning ?? true),
    transmission: (row.transmission as string) ?? "Automatic",
    features,
    image_url: (row.image_url as string | null) ?? null,
    sort_order: Number(row.sort_order ?? 0),
    published_on_web: Boolean(row.published_on_web),
    is_active: Boolean(row.is_active ?? true),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    deleted_at: (row.deleted_at as string | null) ?? null,
  };
}

export async function listVehicleTypesAdmin(): Promise<
  ActionResult<{ items: VehicleType[]; tableReady: boolean }>
> {
  try {
    await assertPermission("settings.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vehicle_types")
      .select("*")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      if (isMissingRelationError(error)) {
        return actionSuccess({ items: [], tableReady: false });
      }
      throw mapPostgresError(error);
    }

    return actionSuccess({
      items: ((data ?? []) as Record<string, unknown>[]).map(mapVehicleTypeRow),
      tableReady: true,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

async function ensureUniqueSlug(
  base: string,
  excludeId?: string,
): Promise<string> {
  const supabase = await createClient();
  let candidate = base || "tipo";
  let attempt = 0;

  while (attempt < 20) {
    let query = supabase
      .from("vehicle_types")
      .select("id")
      .eq("slug", candidate)
      .is("deleted_at", null)
      .limit(1);

    if (excludeId) query = query.neq("id", excludeId);

    const { data, error } = await query;
    if (error) {
      if (isMissingRelationError(error)) return candidate;
      throw mapPostgresError(error);
    }
    if (!data?.length) return candidate;
    attempt += 1;
    candidate = `${base}-${attempt + 1}`;
  }

  return `${base}-${Date.now()}`;
}

export async function createVehicleType(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("settings.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = vehicleTypeSchema.safeParse({
      name: formData.get("name"),
      nameEn: formData.get("nameEn"),
      description: formData.get("description"),
      descriptionEn: formData.get("descriptionEn"),
      referenceModels: formData.get("referenceModels"),
      referenceModelsEn: formData.get("referenceModelsEn"),
      dailyRate: formData.get("dailyRate"),
      passengers: formData.get("passengers") || 5,
      luggage: formData.get("luggage") || 2,
      luggageLabel: formData.get("luggageLabel"),
      luggageLabelEn: formData.get("luggageLabelEn"),
      transmission: formData.get("transmission") || "Automatic",
      publishedOnWeb: formData.get("publishedOnWeb") === "on",
      imageUrl: formData.get("imageUrl"),
      sortOrder: formData.get("sortOrder") || 0,
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const slug = await ensureUniqueSlug(slugify(parsed.data.name));
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vehicle_types")
      .insert({
        slug,
        name: parsed.data.name,
        name_en: parsed.data.nameEn ?? null,
        description: parsed.data.description ?? null,
        description_en: parsed.data.descriptionEn ?? null,
        reference_models: parsed.data.referenceModels ?? null,
        reference_models_en: parsed.data.referenceModelsEn ?? null,
        daily_rate: parsed.data.dailyRate,
        passengers: parsed.data.passengers,
        luggage: parsed.data.luggage,
        luggage_label: parsed.data.luggageLabel ?? null,
        luggage_label_en: parsed.data.luggageLabelEn ?? null,
        transmission: parsed.data.transmission ?? "Automatic",
        published_on_web: parsed.data.publishedOnWeb,
        image_url: parsed.data.imageUrl ?? null,
        sort_order: parsed.data.sortOrder,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) {
      if (isMissingRelationError(error)) {
        return actionError(
          "La tabla de tipos de vehículo aún no está migrada en la base de datos.",
        );
      }
      throw mapPostgresError(error);
    }

    const id = (data as { id: string }).id;
    await writeAuditLog({
      userId: user.id,
      action: "vehicle_type.create",
      entityType: "vehicle_type",
      entityId: id,
    });

    revalidatePath("/dashboard/configuracion/tipos-vehiculo");
    revalidatePath("/dashboard/configuracion");
    revalidatePath("/dashboard/vehiculos");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function updateVehicleType(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("settings.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = vehicleTypeUpdateSchema.safeParse({
      name: formData.get("name") || undefined,
      nameEn: formData.get("nameEn") || undefined,
      description: formData.get("description") || undefined,
      descriptionEn: formData.get("descriptionEn") || undefined,
      referenceModels: formData.get("referenceModels") || undefined,
      referenceModelsEn: formData.get("referenceModelsEn") || undefined,
      dailyRate: formData.get("dailyRate") || undefined,
      passengers: formData.get("passengers") || undefined,
      luggage: formData.get("luggage") || undefined,
      luggageLabel: formData.get("luggageLabel") || undefined,
      luggageLabelEn: formData.get("luggageLabelEn") || undefined,
      transmission: formData.get("transmission") || undefined,
      publishedOnWeb:
        formData.get("publishedOnWeb") === null
          ? undefined
          : formData.get("publishedOnWeb") === "on",
      imageUrl: formData.get("imageUrl"),
      sortOrder: formData.get("sortOrder") || undefined,
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const row: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) {
      row.name = parsed.data.name;
      row.slug = await ensureUniqueSlug(slugify(parsed.data.name), id);
    }
    if (parsed.data.nameEn !== undefined) row.name_en = parsed.data.nameEn ?? null;
    if (parsed.data.description !== undefined)
      row.description = parsed.data.description ?? null;
    if (parsed.data.descriptionEn !== undefined)
      row.description_en = parsed.data.descriptionEn ?? null;
    if (parsed.data.referenceModels !== undefined)
      row.reference_models = parsed.data.referenceModels ?? null;
    if (parsed.data.referenceModelsEn !== undefined)
      row.reference_models_en = parsed.data.referenceModelsEn ?? null;
    if (parsed.data.dailyRate !== undefined) row.daily_rate = parsed.data.dailyRate;
    if (parsed.data.passengers !== undefined)
      row.passengers = parsed.data.passengers;
    if (parsed.data.luggage !== undefined) row.luggage = parsed.data.luggage;
    if (parsed.data.luggageLabel !== undefined)
      row.luggage_label = parsed.data.luggageLabel ?? null;
    if (parsed.data.luggageLabelEn !== undefined)
      row.luggage_label_en = parsed.data.luggageLabelEn ?? null;
    if (parsed.data.transmission !== undefined)
      row.transmission = parsed.data.transmission ?? "Automatic";
    if (parsed.data.publishedOnWeb !== undefined)
      row.published_on_web = parsed.data.publishedOnWeb;
    if (parsed.data.imageUrl !== undefined)
      row.image_url = parsed.data.imageUrl ?? null;
    if (parsed.data.sortOrder !== undefined)
      row.sort_order = parsed.data.sortOrder;

    const supabase = await createClient();
    const { error } = await supabase
      .from("vehicle_types")
      .update(row)
      .eq("id", id)
      .is("deleted_at", null);

    if (error) {
      if (isMissingRelationError(error)) {
        return actionError(
          "La tabla de tipos de vehículo aún no está migrada en la base de datos.",
        );
      }
      throw mapPostgresError(error);
    }

    await writeAuditLog({
      userId: user.id,
      action: "vehicle_type.update",
      entityType: "vehicle_type",
      entityId: id,
    });

    revalidatePath("/dashboard/configuracion/tipos-vehiculo");
    revalidatePath("/dashboard/vehiculos");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function deactivateVehicleType(
  id: string,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("settings.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("vehicle_types")
      .update({
        is_active: false,
        published_on_web: false,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      if (isMissingRelationError(error)) {
        return actionError(
          "La tabla de tipos de vehículo aún no está migrada en la base de datos.",
        );
      }
      throw mapPostgresError(error);
    }

    await writeAuditLog({
      userId: user.id,
      action: "vehicle_type.deactivate",
      entityType: "vehicle_type",
      entityId: id,
    });

    revalidatePath("/dashboard/configuracion/tipos-vehiculo");
    revalidatePath("/dashboard/vehiculos");
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
