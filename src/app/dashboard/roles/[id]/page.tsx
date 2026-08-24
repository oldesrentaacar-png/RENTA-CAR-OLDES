import { notFound } from "next/navigation";

import {
  getRoleWithPermissions,
  listAllPermissions,
} from "@/app/dashboard/roles/actions";
import { RolePermissionsForm } from "@/components/forms/role-permissions-form";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { isSupabaseConfigured } from "@/lib/env";

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();

  const [roleResult, permissionsResult] = configured
    ? await Promise.all([getRoleWithPermissions(id), listAllPermissions()])
    : [null, null];

  if (configured && roleResult && !roleResult.success) notFound();

  const role = roleResult?.success ? roleResult.data : null;
  const permissions = permissionsResult?.success ? permissionsResult.data : [];

  return (
    <PermissionGuard permission="roles.manage">
      <div className="space-y-6">
        <PageHeader
          title={role ? `Permisos: ${role.name}` : "Rol"}
          description={role?.description ?? "Configure los permisos del rol."}
          breadcrumbs={[
            { label: "Roles", href: "/dashboard/roles" },
            { label: role?.name ?? "Detalle" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : role ? (
          <RolePermissionsForm
            role={role}
            permissions={permissions}
            selectedPermissionIds={role.permissionIds}
          />
        ) : null}
      </div>
    </PermissionGuard>
  );
}
