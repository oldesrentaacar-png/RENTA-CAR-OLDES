import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { assertPermission } from "@/lib/auth/guards";
import {
  isMissingRelationError,
  mapPostgresError,
  toUserMessage,
} from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { asNumber } from "@/lib/safe-number";
import { createClient } from "@/lib/supabase/server";
import type { AccessoryCatalogItem } from "@/types/database";

function mapAccessoryRow(row: Record<string, unknown>): AccessoryCatalogItem {
  return {
    id: String(row.id ?? ""),
    code: String(row.code ?? ""),
    name_es: String(row.name_es ?? ""),
    name_en: (row.name_en as string | null) ?? null,
    icon: (row.icon as string | null) ?? null,
    sort_order: asNumber(row.sort_order, 0),
    is_active: Boolean(row.is_active ?? true),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** Lectura segura para la página (no Server Action). */
export async function listAccessories(): Promise<
  ActionResult<{ items: AccessoryCatalogItem[]; tableReady: boolean }>
> {
  try {
    await assertPermission("settings.view");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("accessory_catalog")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name_es", { ascending: true });

    if (error) {
      if (isMissingRelationError(error)) {
        return actionSuccess({ items: [], tableReady: false });
      }
      throw mapPostgresError(error);
    }

    return actionSuccess({
      items: ((data ?? []) as Record<string, unknown>[]).map(mapAccessoryRow),
      tableReady: true,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
