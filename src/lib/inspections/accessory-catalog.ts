import { OLDES_ACCESSORIES } from "@/lib/contracts/oldes-terms";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { DefaultChecklistItem } from "@/lib/inspections/defaults";

export type AccessoryCatalogItem = {
  key: string;
  label: string;
};

/** Fallback when `accessory_catalog` is empty or unavailable. */
export function getOldesAccessoryFallback(): AccessoryCatalogItem[] {
  return OLDES_ACCESSORIES.map((item) => ({
    key: item.key,
    label: item.label,
  }));
}

/**
 * Loads active accessories from `accessory_catalog`, falling back to OLDES defaults.
 * Graceful if the table is missing or the query fails.
 */
export async function listAccessoryCatalog(): Promise<AccessoryCatalogItem[]> {
  if (!isSupabaseConfigured()) {
    return getOldesAccessoryFallback();
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("accessory_catalog")
      .select("code, name_es, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error || !data?.length) {
      return getOldesAccessoryFallback();
    }

    return (data as Array<{ code: string; name_es: string }>).map((row) => ({
      key: row.code.toLowerCase(),
      label: row.name_es.toUpperCase(),
    }));
  } catch {
    return getOldesAccessoryFallback();
  }
}

/** Checklist defaults for new inspections (DB catalog or OLDES). */
export async function getDefaultChecklistFromCatalog(): Promise<
  DefaultChecklistItem[]
> {
  const items = await listAccessoryCatalog();
  return items.map((item) => ({
    itemKey: item.key,
    label: item.label,
    status: "OK" as const,
  }));
}
