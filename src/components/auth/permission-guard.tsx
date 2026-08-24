"use client";

import type { ReactNode } from "react";

import { usePermissions } from "@/components/auth/permission-provider";
import { Unauthorized } from "@/components/auth/unauthorized";
import type { PermissionKey } from "@/lib/auth/permissions";

export type PermissionGuardProps = {
  permission: PermissionKey | PermissionKey[];
  mode?: "any" | "all";
  fallback?: ReactNode;
  children: ReactNode;
};

export function PermissionGuard({
  permission,
  mode = "any",
  fallback,
  children,
}: PermissionGuardProps) {
  const { has, hasAny, hasAll } = usePermissions();

  const keys = Array.isArray(permission) ? permission : [permission];
  const allowed =
    mode === "all" ? hasAll(keys) : keys.length === 1 ? has(keys[0]) : hasAny(keys);

  if (!allowed) {
    return fallback !== undefined ? <>{fallback}</> : <Unauthorized compact />;
  }

  return <>{children}</>;
}
