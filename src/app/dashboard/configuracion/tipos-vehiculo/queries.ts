import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { assertPermission } from "@/lib/auth/guards";
import {
  isMissingRelationError,
  mapPostgresError,
  toUserMessage,
} from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { asNumber, asOptionalNumber } from "@/lib/safe-number";
import { createClient } from "@/lib/supabase/server";
import type { VehicleType } from "@/types/database";

export function mapVehicleTypeRow(row: Record<string, unknown>): VehicleType {
  const featuresRaw = row.features;
  const features = Array.isArray(featuresRaw)
    ? featuresRaw.map(String)
    : [];

  return {
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    name_en: (row.name_en as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    description_en: (row.description_en as string | null) ?? null,
    reference_models: (row.reference_models as string | null) ?? null,
    reference_models_en: (row.reference_models_en as string | null) ?? null,
    daily_rate: asNumber(row.daily_rate, 0),
    weekly_rate: asOptionalNumber(row.weekly_rate),
    passengers: asNumber(row.passengers, 5),
    luggage: asNumber(row.luggage, 2),
    luggage_label: (row.luggage_label as string | null) ?? null,
    luggage_label_en: (row.luggage_label_en as string | null) ?? null,
    doors: asNumber(row.doors, 4),
    air_conditioning: Boolean(row.air_conditioning ?? true),
    transmission: (row.transmission as string) ?? "Automatic",
    features,
    image_url: (row.image_url as string | null) ?? null,
    sort_order: asNumber(row.sort_order, 0),
    published_on_web: Boolean(row.published_on_web),
    is_active: Boolean(row.is_active ?? true),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    deleted_at: (row.deleted_at as string | null) ?? null,
  };
}

/** Lectura segura para la página (no Server Action). */
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
      .order("deleted_at", { ascending: true, nullsFirst: true })
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
