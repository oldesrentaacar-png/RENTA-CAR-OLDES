import { notFound } from "next/navigation";

import {
  getUser,
  listRolesForSelect,
} from "@/app/dashboard/usuarios/actions";
import { UserForm } from "@/components/forms/user-form";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { DisableUserButton } from "@/app/dashboard/usuarios/[id]/edit/disable-user-button";
import { isSupabaseConfigured } from "@/lib/env";

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const [userResult, rolesResult] = configured
    ? await Promise.all([getUser(id), listRolesForSelect()])
    : [null, null];

  if (configured && userResult && !userResult.success) notFound();

  const user = userResult?.success ? userResult.data : null;
  const roles = rolesResult?.success ? rolesResult.data : [];

  return (
    <PermissionGuard permission="users.edit">
      <div className="space-y-6">
        <PageHeader
          title={user ? `${user.first_name} ${user.last_name}` : "Editar usuario"}
          breadcrumbs={[
            { label: "Usuarios", href: "/dashboard/usuarios" },
            { label: "Editar" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : user ? (
          <>
            <UserForm user={user} roles={roles} redirectTo="/dashboard/usuarios" />
            {user.status !== "INACTIVE" ? (
              <DisableUserButton userId={user.id} />
            ) : null}
          </>
        ) : null}
      </div>
    </PermissionGuard>
  );
}
