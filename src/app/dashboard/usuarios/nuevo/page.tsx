import { listRolesForSelect } from "@/app/dashboard/usuarios/actions";
import { UserForm } from "@/components/forms/user-form";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { isSupabaseConfigured } from "@/lib/env";

export default async function NuevoUsuarioPage() {
  const configured = isSupabaseConfigured();
  const rolesResult = configured ? await listRolesForSelect() : null;
  const roles = rolesResult?.success ? rolesResult.data : [];

  return (
    <PermissionGuard permission="users.create">
      <div className="space-y-6">
        <PageHeader
          title="Nuevo usuario"
          description="Invite un usuario al panel administrativo."
          breadcrumbs={[
            { label: "Usuarios", href: "/dashboard/usuarios" },
            { label: "Nuevo" },
          ]}
        />
        {!configured ? <SetupBanner /> : <UserForm roles={roles} />}
      </div>
    </PermissionGuard>
  );
}
