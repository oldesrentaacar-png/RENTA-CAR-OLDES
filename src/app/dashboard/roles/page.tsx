import Link from "next/link";

import { listRoles } from "@/app/dashboard/roles/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { isSupabaseConfigured } from "@/lib/env";

export default async function RolesPage() {
  const configured = isSupabaseConfigured();
  const result = configured ? await listRoles() : null;
  const data = result?.success ? result.data : [];
  const error = result && !result.success ? result.error : null;

  return (
    <ModuleListShell
      title="Roles y permisos"
      description="Roles del sistema y asignación de permisos."
      permission="roles.manage"
      configured={configured}
      error={error}
      count={data.length}
      countLabel="roles mostrados"
    >
      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin roles"
        emptyDescription="Configure roles para controlar el acceso al sistema."
        columns={[
          {
            key: "name",
            header: "Nombre",
            cell: (row) => (
              <Link
                href={`/dashboard/roles/${row.id}`}
                className="font-medium text-brand hover:underline"
              >
                {row.name}
              </Link>
            ),
          },
          {
            key: "slug",
            header: "Slug",
            cell: (row) => row.slug,
            className: "hidden sm:table-cell",
          },
          {
            key: "description",
            header: "Descripción",
            cell: (row) => row.description ?? "—",
            className: "hidden md:table-cell max-w-xs truncate",
          },
          {
            key: "system",
            header: "Sistema",
            cell: (row) =>
              row.is_system ? (
                <Badge variant="brand">Sistema</Badge>
              ) : (
                <Badge variant="outline">Personalizado</Badge>
              ),
          },
        ]}
      />
    </ModuleListShell>
  );
}
