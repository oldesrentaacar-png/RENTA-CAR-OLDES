import Link from "next/link";

import { listVehicles } from "@/app/dashboard/vehiculos/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { ListFilters } from "@/components/dashboard/list-filters";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { VEHICLE_STATUS_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/env";

export default async function VehiculosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const filterParams = {
    ...params,
    publishedOnWeb: params.published,
  };
  const result = configured ? await listVehicles(filterParams) : null;
  const data = result?.success ? result.data.items : [];
  const error = result && !result.success ? result.error : null;

  const statusOptions = Object.entries(VEHICLE_STATUS_LABELS).map(
    ([value, label]) => ({ value, label }),
  );

  return (
    <ModuleListShell
      title="Vehículos"
      description="Inventario de la flota disponible para renta."
      permission="vehicles.view"
      configured={configured}
      error={error}
      count={data.length}
      countLabel="vehículos mostrados"
      actions={
        <Link
          href="/dashboard/vehiculos/nuevo"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Nuevo vehículo
        </Link>
      }
    >
      <form method="get" className="mb-4">
        <ListFilters
          q={String(params.q ?? "")}
          status={String(params.status ?? "")}
          published={String(params.published ?? "")}
          statusOptions={statusOptions}
          showPublished
        />
      </form>

      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin vehículos"
        emptyDescription="Agregue vehículos para comenzar a operar la flota."
        columns={[
          {
            key: "vehicle",
            header: "Vehículo",
            cell: (row) => (
              <Link href={`/dashboard/vehiculos/${row.id}`} className="font-medium hover:underline">
                {row.brand} {row.model} {row.year}
              </Link>
            ),
          },
          { key: "plate", header: "Placa", cell: (row) => row.plate },
          {
            key: "rate",
            header: "Tarifa/día",
            cell: (row) => formatMoney(row.daily_rate),
            className: "hidden sm:table-cell",
          },
          {
            key: "status",
            header: "Estado",
            cell: (row) => <StatusBadge status={row.status} />,
          },
          {
            key: "web",
            header: "Web",
            cell: (row) => (row.published_on_web ? "Sí" : "No"),
            className: "hidden lg:table-cell",
          },
        ]}
      />
    </ModuleListShell>
  );
}
