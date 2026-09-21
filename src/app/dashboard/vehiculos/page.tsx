import Link from "next/link";

import { listVehicles } from "@/app/dashboard/vehiculos/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { ListFilters } from "@/components/dashboard/list-filters";
import { VehicleListActions } from "@/components/dashboard/vehicle-list-actions";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
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
  const pageData = result?.success ? result.data : null;
  const data = pageData?.items ?? [];
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
      count={pageData?.total ?? data.length}
      countLabel="vehículos"
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
          searchPlaceholder="Marca, modelo o placa…"
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
          {
            key: "actions",
            header: "Acciones",
            cell: (row) => <VehicleListActions vehicleId={row.id} />,
            className: "text-right",
          },
        ]}
      />

      {pageData ? (
        <Pagination
          page={pageData.page}
          totalPages={pageData.totalPages}
          basePath="/dashboard/vehiculos"
          searchParams={{
            q: String(params.q ?? "") || undefined,
            status: String(params.status ?? "") || undefined,
            published: String(params.published ?? "") || undefined,
          }}
        />
      ) : null}
    </ModuleListShell>
  );
}
