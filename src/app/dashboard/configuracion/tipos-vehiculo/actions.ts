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
import { isCloudinaryConfigured, isSupabaseConfigured } from "@/lib/env";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import {
  vehicleTypeSchema,
  vehicleTypeUpdateSchema,
} from "@/lib/validation/vehicle-type";
import { getSignedUploadParams } from "@/lib/cloudinary/upload";

export async function getVehicleTypeImageUploadParams(): Promise<
  ActionResult<{
    cloudName: string;
    apiKey: string;
    timestamp: number;
    folder: string;
    signature: string;
  }>
> {
  try {
    await assertPermission("settings.edit");
    const params = getSignedUploadParams("rent-a-car-pro/vehicle-types");
    if (!params.ok) return actionError(params.message);
    return actionSuccess({
      cloudName: params.cloudName,
      apiKey: params.apiKey,
      timestamp: params.timestamp,
      folder: params.folder,
      signature: params.signature,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

async function resolveVehicleTypeImageUrl(
  formData: FormData,
): Promise<string | null | undefined> {
  const rawFile = formData.get("imageFile");
  const file =
    rawFile &&
    typeof rawFile === "object" &&
    "arrayBuffer" in rawFile &&
    "size" in rawFile &&
    typeof (rawFile as Blob).size === "number" &&
    (rawFile as Blob).size > 0
      ? (rawFile as Blob)
      : null;

  if (file) {
    const mime =
      "type" in file && typeof file.type === "string" ? file.type : "";
    if (mime && !mime.startsWith("image/")) {
      throw new Error("El archivo debe ser una imagen.");
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new Error("La imagen no puede superar 8 MB.");
    }
    if (!isCloudinaryConfigured()) {
      throw new Error(
        "Cloudinary no está configurado. No se pueden subir imágenes desde el equipo.",
      );
    }
    const { uploadImageFromBuffer } = await import("@/lib/cloudinary/upload");
    const buffer = Buffer.from(await file.arrayBuffer());
    const upload = await uploadImageFromBuffer(buffer, {
      folder: "rent-a-car-pro/vehicle-types",
      publicId: `type-${Date.now()}`,
      tags: ["vehicle_type"],
    });
    if (!upload.ok) {
      throw new Error(upload.message);
    }
    return upload.secureUrl;
  }

  const cleared = formData.get("imageUrlCleared") === "1";
  const imageUrl = formData.get("imageUrl");
  if (typeof imageUrl === "string" && imageUrl.trim() !== "") {
    return imageUrl.trim();
  }
  // Solo borrar la imagen si el usuario pulsó «Quitar».
  if (cleared) return null;
  // Sin archivo nuevo y sin URL → no tocar image_url en update.
  return undefined;
}

async function ensureUniqueSlug(
  base: string,
  excludeId?: string,
): Promise<string> {
  const supabase = await createClient();
  let candidate = base || "tipo";
  let attempt = 0;

  // La columna `slug` es UNIQUE global (incluye filas soft-deleted).
  // Hay que mirar TODAS las filas; si no, al editar/crear choca con un
  // tipo desactivado y Postgres responde 23505 ("Ya existe un registro…").
  while (attempt < 20) {
    let query = supabase
      .from("vehicle_types")
      .select("id")
      .eq("slug", candidate)
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

function vehicleTypeConflictMessage(error: unknown): string | null {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code ?? "")
      : "";
  if (code !== "23505") return null;
  return (
    "Ya existe un tipo de vehículo con ese nombre (o uno desactivado que " +
    "aún reserva el identificador). Use un nombre distinto o reactive el tipo anterior."
  );
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

    let imageUrl = parsed.data.imageUrl ?? null;
    try {
      const resolved = await resolveVehicleTypeImageUrl(formData);
      if (resolved !== undefined) imageUrl = resolved;
    } catch (uploadError) {
      return actionError(toUserMessage(uploadError));
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
        image_url: imageUrl,
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
      const conflict = vehicleTypeConflictMessage(error);
      if (conflict) return actionError(conflict);
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

    const supabase = await createClient();
    const { data: current, error: currentError } = await supabase
      .from("vehicle_types")
      .select("id, slug, name")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (currentError) {
      if (isMissingRelationError(currentError)) {
        return actionError(
          "La tabla de tipos de vehículo aún no está migrada en la base de datos.",
        );
      }
      throw mapPostgresError(currentError);
    }
    if (!current) {
      return actionError("No se encontró el tipo de vehículo a editar.");
    }

    const row: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) {
      row.name = parsed.data.name;
      const desiredSlug = slugify(parsed.data.name) || "tipo";
      const currentSlug = String(
        (current as { slug?: string }).slug ?? "",
      );
      // Solo regenerar slug si el nombre implica otro identificador.
      if (desiredSlug !== currentSlug) {
        row.slug = await ensureUniqueSlug(desiredSlug, id);
      }
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
    try {
      const resolved = await resolveVehicleTypeImageUrl(formData);
      if (resolved !== undefined) {
        row.image_url = resolved;
      }
    } catch (uploadError) {
      return actionError(toUserMessage(uploadError));
    }
    if (parsed.data.sortOrder !== undefined)
      row.sort_order = parsed.data.sortOrder;

    if (Object.keys(row).length === 0) {
      return actionSuccess({ id });
    }

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
      const conflict = vehicleTypeConflictMessage(error);
      if (conflict) return actionError(conflict);
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
    const { data: current, error: currentError } = await supabase
      .from("vehicle_types")
      .select("id, slug")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (currentError) {
      if (isMissingRelationError(currentError)) {
        return actionError(
          "La tabla de tipos de vehículo aún no está migrada en la base de datos.",
        );
      }
      throw mapPostgresError(currentError);
    }
    if (!current) {
      return actionError("No se encontró el tipo de vehículo a desactivar.");
    }

    const currentSlug = String((current as { slug?: string }).slug || "tipo");
    // Libera el slug UNIQUE para que se pueda volver a crear/editar con ese nombre.
    const freedSlug = await ensureUniqueSlug(
      `${currentSlug}-deleted-${id.replace(/-/g, "").slice(0, 8)}`,
      id,
    );

    const { error } = await supabase
      .from("vehicle_types")
      .update({
        is_active: false,
        published_on_web: false,
        deleted_at: new Date().toISOString(),
        slug: freedSlug,
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
