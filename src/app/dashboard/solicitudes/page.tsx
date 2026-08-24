import Link from "next/link";

import { listWebRequests } from "@/app/dashboard/solicitudes/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { ListFilters } from "@/components/dashboard/list-filters";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { WEB_REQUEST_STATUS_LABELS } from "@/lib/labels";
import { formatAppDate } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const result = configured ? await listWebRequests(params) : null;
  const data = result?.success ? result.data.items : [];
  const error = result && !result.success ? result.error : null;

  const statusOptions = Object.entries(WEB_REQUEST_STATUS_LABELS).map(
    ([value, label]) => ({ value, label }),
  );

  return (
    <ModuleListShell
      title="Solicitudes"
      description="Solicitudes recibidas desde la web y otros canales."
      permission="requests.view"
      configured={configured}
      error={error}
      count={data.length}
      countLabel="registros mostrados"
    >
      <form method="get" className="mb-4">
        <ListFilters
          q={String(params.q ?? "")}
          status={String(params.status ?? "")}
          statusOptions={statusOptions}
        />
      </form>

      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin solicitudes"
        emptyDescription="Las solicitudes entrantes aparecerán aquí."
        columns={[
          {
            key: "code",
            header: "Código",
            cell: (row) => (
              <Link href={`/dashboard/solicitudes/${row.id}`} className="font-medium hover:underline">
                {row.code}
              </Link>
            ),
          },
          {
            key: "client",
            header: "Cliente",
            cell: (row) => `${row.first_name} ${row.last_name}`,
          },
          { key: "phone", header: "Teléfono", cell: (row) => row.phone },
          {
            key: "pickup",
            header: "Recogida",
            cell: (row) => formatAppDate(row.pickup_date),
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
