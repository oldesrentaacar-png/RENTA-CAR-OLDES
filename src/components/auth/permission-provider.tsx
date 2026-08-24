"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { PermissionKey } from "@/lib/auth/permissions";
import type { Profile } from "@/types/database";

export type PermissionContextValue = {
  permissions: Set<PermissionKey>;
  profile: Profile | null;
  has: (key: PermissionKey) => boolean;
  hasAny: (keys: PermissionKey[]) => boolean;
  hasAll: (keys: PermissionKey[]) => boolean;
};

const PermissionContext = createContext<PermissionContextValue | null>(null);

export type PermissionProviderProps = {
  permissions: PermissionKey[];
  profile: Profile | null;
  children: ReactNode;
};

export function PermissionProvider({
  permissions,
  profile,
  children,
}: PermissionProviderProps) {
  const value = useMemo<PermissionContextValue>(() => {
    const set = new Set(permissions);

    return {
      permissions: set,
      profile,
      has: (key) => set.has(key),
      hasAny: (keys) => keys.some((key) => set.has(key)),
      hasAll: (keys) => keys.every((key) => set.has(key)),
    };
  }, [permissions, profile]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions(): PermissionContextValue {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
    throw new Error("usePermissions must be used within PermissionProvider");
  }
  return ctx;
}
