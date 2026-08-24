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
import { createClient } from "@/lib/supabase/server";
import {
  accessoryCatalogSchema,
  accessoryCatalogUpdateSchema,
} from "@/lib/validation/accessory";
import type { AccessoryCatalogItem } from "@/types/database";

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
      items: (data ?? []) as AccessoryCatalogItem[],
      tableReady: true,
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function createAccessory(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("settings.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = accessoryCatalogSchema.safeParse({
      code: formData.get("code"),
      nameEs: formData.get("nameEs"),
      nameEn: formData.get("nameEn"),
      sortOrder: formData.get("sortOrder") || 0,
      isActive: formData.get("isActive") === "on",
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("accessory_catalog")
      .insert({
        code: parsed.data.code.toUpperCase(),
        name_es: parsed.data.nameEs,
        name_en: parsed.data.nameEn ?? null,
        sort_order: parsed.data.sortOrder,
        is_active: parsed.data.isActive,
      })
      .select("id")
      .single();

    if (error) {
      if (isMissingRelationError(error)) {
        return actionError(
          "El catálogo de accesorios aún no está migrado en la base de datos.",
        );
      }
      throw mapPostgresError(error);
    }

    const id = (data as { id: string }).id;
    await writeAuditLog({
      userId: user.id,
      action: "accessory.create",
      entityType: "accessory_catalog",
      entityId: id,
    });

    revalidatePath("/dashboard/configuracion/accesorios");
    revalidatePath("/dashboard/configuracion");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function updateAccessory(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await assertPermission("settings.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const parsed = accessoryCatalogUpdateSchema.safeParse({
      code: formData.get("code") || undefined,
      nameEs: formData.get("nameEs") || undefined,
      nameEn: formData.get("nameEn"),
      sortOrder: formData.get("sortOrder") || undefined,
      isActive:
        formData.get("isActive") === null
          ? undefined
          : formData.get("isActive") === "on",
    });

    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const row: Record<string, unknown> = {};
    if (parsed.data.code !== undefined) row.code = parsed.data.code.toUpperCase();
    if (parsed.data.nameEs !== undefined) row.name_es = parsed.data.nameEs;
    if (parsed.data.nameEn !== undefined) row.name_en = parsed.data.nameEn ?? null;
    if (parsed.data.sortOrder !== undefined) row.sort_order = parsed.data.sortOrder;
    if (parsed.data.isActive !== undefined) row.is_active = parsed.data.isActive;

    const supabase = await createClient();
    const { error } = await supabase
      .from("accessory_catalog")
      .update(row)
      .eq("id", id);

    if (error) {
      if (isMissingRelationError(error)) {
        return actionError(
          "El catálogo de accesorios aún no está migrado en la base de datos.",
        );
      }
      throw mapPostgresError(error);
    }

    await writeAuditLog({
      userId: user.id,
      action: "accessory.update",
      entityType: "accessory_catalog",
      entityId: id,
    });

    revalidatePath("/dashboard/configuracion/accesorios");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function deactivateAccessory(
  id: string,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("settings.edit");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("accessory_catalog")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      if (isMissingRelationError(error)) {
        return actionError(
          "El catálogo de accesorios aún no está migrado en la base de datos.",
        );
      }
      throw mapPostgresError(error);
    }

    await writeAuditLog({
      userId: user.id,
      action: "accessory.deactivate",
      entityType: "accessory_catalog",
      entityId: id,
    });

    revalidatePath("/dashboard/configuracion/accesorios");
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
