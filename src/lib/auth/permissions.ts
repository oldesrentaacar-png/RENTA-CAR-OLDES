import { isSupabaseConfigured } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export const PERMISSION_KEYS = [
  "dashboard.view",
  "requests.view",
  "requests.create",
  "requests.edit",
  "requests.delete",
  "customers.view",
  "customers.create",
  "customers.edit",
  "customers.delete",
  "quotes.view",
  "quotes.create",
  "quotes.edit",
  "quotes.delete",
  "quotes.send",
  "quotes.accept",
  "reservations.view",
  "reservations.create",
  "reservations.edit",
  "reservations.cancel",
  "calendar.view",
  "vehicles.view",
  "vehicles.create",
  "vehicles.edit",
  "vehicles.archive",
  "vehicles.publish",
  "contracts.view",
  "contracts.create",
  "contracts.edit",
  "contracts.sign",
  "contracts.cancel",
  "inspections.view",
  "inspections.create",
  "inspections.edit",
  "finance.view",
  "finance.create",
  "finance.edit",
  "finance.delete",
  "maintenance.view",
  "maintenance.create",
  "maintenance.edit",
  "reports.view",
  "reports.export",
  "users.view",
  "users.create",
  "users.edit",
  "users.disable",
  "roles.manage",
  "settings.view",
  "settings.edit",
  "audit.view",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

export async function getEffectivePermissions(
  userId: string,
): Promise<Set<PermissionKey>> {
  if (!isSupabaseConfigured()) {
    return new Set();
  }

  const supabase = await createClient();

  const { data: rpcPermissions, error: rpcError } = await supabase.rpc(
    "get_user_permissions",
    { p_user_id: userId },
  );

  if (!rpcError && Array.isArray(rpcPermissions)) {
    return new Set(
      rpcPermissions.filter(isPermissionKey) as PermissionKey[],
    );
  }

  // Fallback: prefer service-role so staff without roles.manage still load menus.
  let reader = supabase;
  try {
    const { isSupabaseAdminConfigured } = await import("@/lib/env");
    if (isSupabaseAdminConfigured()) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      reader = createAdminClient();
    }
  } catch {
    // Keep user-scoped client.
  }

  const { data: profile, error: profileError } = await reader
    .from("profiles")
    .select("role_id")
    .eq("id", userId)
    .maybeSingle();

  const profileRow = profile as { role_id: string | null } | null;

  if (profileError || !profileRow?.role_id) {
    return new Set();
  }

  const [{ data: rolePermissionRows }, { data: overrideRows }] =
    await Promise.all([
      reader
        .from("role_permissions")
        .select("permission_id")
        .eq("role_id", profileRow.role_id),
      reader
        .from("user_permission_overrides")
        .select("permission_id, effect")
        .eq("user_id", userId),
    ]);

  const effective = new Set<PermissionKey>();
  const permissionIds = new Set<string>();
  for (const row of (rolePermissionRows ?? []) as Array<{ permission_id: string }>) {
    permissionIds.add(row.permission_id);
  }

  const overrideMap = new Map<string, "GRANT" | "DENY">();
  for (const row of (overrideRows ?? []) as Array<{
    permission_id: string;
    effect: "GRANT" | "DENY";
  }>) {
    overrideMap.set(row.permission_id, row.effect);
  }

  if (permissionIds.size === 0 && overrideMap.size === 0) {
    return effective;
  }

  const allPermissionIds = [
    ...new Set([...permissionIds, ...overrideMap.keys()]),
  ];

  const { data: permissionRows } = await reader
    .from("permissions")
    .select("id, key")
    .in("id", allPermissionIds);

  const keyById = new Map(
    ((permissionRows ?? []) as Array<{ id: string; key: string }>).map(
      (row) => [row.id, row.key],
    ),
  );

  for (const permissionId of permissionIds) {
    const key = keyById.get(permissionId);
    if (key && isPermissionKey(key)) {
      effective.add(key);
    }
  }

  for (const [permissionId, effect] of overrideMap.entries()) {
    const key = keyById.get(permissionId);
    if (!key || !isPermissionKey(key)) {
      continue;
    }
    if (effect === "GRANT") {
      effective.add(key);
    } else {
      effective.delete(key);
    }
  }

  return effective;
}

export async function hasPermission(
  userId: string,
  permission: PermissionKey,
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_permission", {
    p_user_id: userId,
    p_key: permission,
  });

  if (!error && typeof data === "boolean") {
    return data;
  }

  const permissions = await getEffectivePermissions(userId);
  return permissions.has(permission);
}

export async function requirePermission(
  userId: string,
  permission: PermissionKey,
): Promise<void> {
  const allowed = await hasPermission(userId, permission);
  if (!allowed) {
    throw new AppError(
      "No tiene permiso para realizar esta acción.",
      {
        code: "FORBIDDEN",
        statusCode: 403,
      },
    );
  }
}

export async function hasAnyPermission(
  userId: string,
  permissions: PermissionKey[],
): Promise<boolean> {
  const effective = await getEffectivePermissions(userId);
  return permissions.some((permission) => effective.has(permission));
}

export async function hasAllPermissions(
  userId: string,
  permissions: PermissionKey[],
): Promise<boolean> {
  const effective = await getEffectivePermissions(userId);
  return permissions.every((permission) => effective.has(permission));
}
