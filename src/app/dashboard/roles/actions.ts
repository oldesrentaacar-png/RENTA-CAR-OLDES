"use server";

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/lib/actions/types";
import { writeAuditLog } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/guards";
import { PERMISSION_KEYS } from "@/lib/auth/permissions";
import { mapPostgresError, toUserMessage } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Permission, Role } from "@/types/database";

export type RoleWithPermissions = Role & {
  permissionIds: string[];
};

export async function listRoles(): Promise<ActionResult<Role[]>> {
  try {
    await assertPermission("roles.manage");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("roles")
      .select("*")
      .order("name");

    if (error) throw mapPostgresError(error);

    return actionSuccess((data ?? []) as Role[]);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function getRoleWithPermissions(
  id: string,
): Promise<ActionResult<RoleWithPermissions>> {
  try {
    await assertPermission("roles.manage");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (roleError) throw mapPostgresError(roleError);
    if (!role) return actionError("Rol no encontrado.");

    const { data: rolePermissions, error: permError } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", id);

    if (permError) throw mapPostgresError(permError);

    return actionSuccess({
      ...(role as Role),
      permissionIds: ((rolePermissions ?? []) as Array<{ permission_id: string }>).map(
        (row) => row.permission_id,
      ),
    });
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function listAllPermissions(): Promise<ActionResult<Permission[]>> {
  try {
    await assertPermission("roles.manage");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("permissions")
      .select("*")
      .order("module")
      .order("key");

    if (error) throw mapPostgresError(error);

    const permissions = (data ?? []) as Permission[];
    const knownKeys = new Set<string>(PERMISSION_KEYS);

    return actionSuccess(
      permissions.filter((permission) => knownKeys.has(permission.key)),
    );
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}

export async function updateRolePermissions(
  roleId: string,
  formData: FormData,
): Promise<ActionResult<void>> {
  try {
    const { user } = await assertPermission("roles.manage");
    if (!isSupabaseConfigured()) {
      return actionError("Supabase no está configurado.");
    }

    const supabase = await createClient();
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("is_system, slug")
      .eq("id", roleId)
      .maybeSingle();

    if (roleError) throw mapPostgresError(roleError);
    if (!role) return actionError("Rol no encontrado.");

    const selectedIds = formData
      .getAll("permissionIds")
      .map((value) => String(value));

    await supabase.from("role_permissions").delete().eq("role_id", roleId);

    if (selectedIds.length > 0) {
      const rows = selectedIds.map((permissionId) => ({
        role_id: roleId,
        permission_id: permissionId,
      }));

      const { error: insertError } = await supabase
        .from("role_permissions")
        .insert(rows);

      if (insertError) throw mapPostgresError(insertError);
    }

    await writeAuditLog({
      userId: user.id,
      action: "role.permissions.update",
      entityType: "role",
      entityId: roleId,
      metadata: { count: selectedIds.length },
    });

    revalidatePath("/dashboard/roles");
    revalidatePath(`/dashboard/roles/${roleId}`);
    return actionSuccess(undefined as void);
  } catch (error) {
    return actionError(toUserMessage(error));
  }
}
