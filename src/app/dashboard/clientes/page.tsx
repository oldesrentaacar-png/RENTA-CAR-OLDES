import Link from "next/link";

import { listCustomers } from "@/app/dashboard/clientes/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { ListFilters } from "@/components/dashboard/list-filters";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  getCustomerDisplayName,
  getCustomerTypeLabel,
} from "@/lib/customers";
import { isSupabaseConfigured } from "@/lib/env";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const result = configured ? await listCustomers(params) : null;
  const data = result?.success ? result.data.items : [];
  const error = result && !result.success ? result.error : null;

  return (
    <ModuleListShell
      title="Clientes"
      description="Directorio de clientes registrados en el sistema."
      permission="customers.view"
      configured={configured}
      error={error}
      count={data.length}
      countLabel="clientes mostrados"
      actions={
        <Link
          href="/dashboard/clientes/nuevo"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Nuevo cliente
        </Link>
      }
    >
      <form method="get" className="mb-4">
        <ListFilters q={String(params.q ?? "")} />
      </form>

      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin clientes"
        emptyDescription="Registre clientes para gestionar cotizaciones y reservas."
        columns={[
          {
            key: "name",
            header: "Nombre",
            cell: (row) => (
              <div className="flex flex-col gap-1">
                <Link
                  href={`/dashboard/clientes/${row.id}`}
                  className="font-medium text-brand hover:underline"
                >
                  {getCustomerDisplayName(row)}
                </Link>
                <Badge variant="outline" className="w-fit">
                  {getCustomerTypeLabel(row.customer_type)}
                </Badge>
              </div>
            ),
          },
          { key: "phone", header: "Teléfono", cell: (row) => row.phone },
          {
            key: "email",
            header: "Correo",
            cell: (row) => row.email ?? "—",
            className: "hidden md:table-cell",
          },
          {
            key: "status",
            header: "Estado",
            cell: (row) => <StatusBadge status={row.status} />,
          },
        ]}
      />
    </ModuleListShell>
  );
}
