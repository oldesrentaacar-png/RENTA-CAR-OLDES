import Link from "next/link";

import { listUsers } from "@/app/dashboard/usuarios/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const user = configured ? await getCurrentUser() : null;
  const canEdit = user ? await hasPermission(user.id, "users.edit") : false;

  const result = configured ? await listUsers(params) : null;
  const data = result?.success ? result.data.items : [];
  const error = result && !result.success ? result.error : null;

  return (
    <ModuleListShell
      title="Usuarios"
      description="Usuarios internos con acceso al panel administrativo."
      permission="users.view"
      configured={configured}
      error={error}
      count={data.length}
      countLabel="usuarios mostrados"
      actions={
        <Link
          href="/dashboard/usuarios/nuevo"
          className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Nuevo usuario
        </Link>
      }
    >
      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin usuarios"
        emptyDescription="Invite usuarios para colaborar en la operación."
        columns={[
          {
            key: "name",
            header: "Nombre",
            cell: (row) => (
              <Link
                href={`/dashboard/usuarios/${row.id}/edit`}
                className="font-medium text-brand hover:underline"
              >
                {row.first_name} {row.last_name}
              </Link>
            ),
          },
          { key: "email", header: "Correo", cell: (row) => row.email },
          {
            key: "phone",
            header: "Teléfono",
            cell: (row) => row.phone ?? "—",
            className: "hidden md:table-cell",
          },
          {
            key: "status",
            header: "Estado",
            cell: (row) => <StatusBadge status={row.status} />,
          },
          {
            key: "actions",
            header: "Acciones",
            cell: (row) => (
              <div className="flex flex-wrap gap-2">
                {canEdit ? (
                  <Link href={`/dashboard/usuarios/${row.id}/edit`}>
                    <Button type="button" variant="outline" size="sm">
                      Editar
                    </Button>
                  </Link>
                ) : null}
              </div>
            ),
          },
        ]}
      />
    </ModuleListShell>
  );
}
