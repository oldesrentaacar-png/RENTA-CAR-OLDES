"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { updateRolePermissions } from "@/app/dashboard/roles/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import type { Permission, Role } from "@/types/database";

type RolePermissionsFormProps = {
  role: Role;
  permissions: Permission[];
  selectedPermissionIds: string[];
};

export function RolePermissionsForm({
  role,
  permissions,
  selectedPermissionIds,
}: RolePermissionsFormProps) {
  const router = useRouter();
  const [selected, setSelected] = useState(new Set(selectedPermissionIds));
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const permission of permissions) {
      const list = map.get(permission.module) ?? [];
      list.push(permission);
      map.set(permission.module, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  function toggle(permissionId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData();
    for (const permissionId of selected) {
      formData.append("permissionIds", permissionId);
    }

    const result = await updateRolePermissions(role.id, formData);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {grouped.map(([module, modulePermissions]) => (
        <div key={module} className="rounded-xl border border-border p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            {module}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {modulePermissions.map((permission) => (
              <label
                key={permission.id}
                className="flex items-start gap-3 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="permissionIds"
                  value={permission.id}
                  checked={selected.has(permission.id)}
                  onChange={() => toggle(permission.id)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium">{permission.key}</span>
                  {permission.description ? (
                    <span className="text-muted">{permission.description}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <SubmitButton>Guardar permisos</SubmitButton>
    </form>
  );
}
