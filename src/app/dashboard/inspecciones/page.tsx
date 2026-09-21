import Link from "next/link";

import {
  listInspections,
  listVehiclesForInspectionFilter,
} from "@/app/dashboard/inspecciones/actions";
import { InspectionListActions } from "@/components/dashboard/inspection-list-actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { FilterBar, FilterField } from "@/components/shared/filter-bar";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  FUEL_LEVEL_LABELS,
  INSPECTION_TYPE_LABELS,
} from "@/lib/inspections/defaults";
import { formatAppDate } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";

export default async function InspeccionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const [result, vehiclesResult] = configured
    ? await Promise.all([
        listInspections(params),
        listVehiclesForInspectionFilter(),
      ])
    : [null, null];
  const pageData = result?.success ? result.data : null;
  const data = pageData?.items ?? [];
  const error = result && !result.success ? result.error : null;
  const vehicleOptions = vehiclesResult?.success ? vehiclesResult.data : [];

  const typeValue = String(params.type ?? params.status ?? "");
  const vehicleId = String(params.vehicleId ?? "");
  const q = String(params.q ?? "");

  return (
    <ModuleListShell
      title="Inspecciones"
      description="Registro de salidas (código …A) y entradas (…B) por vehículo. Misma secuencia = mismo alquiler."
      permission="inspections.view"
      configured={configured}
      error={error}
      count={pageData?.total ?? data.length}
      countLabel="inspecciones"
      actions={
        <Link
          href="/dashboard/inspecciones/nuevo"
          className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Nueva inspección
        </Link>
      }
    >
      <form method="get" className="mb-4">
        <FilterBar>
          <FilterField label="Buscar vehículo" className="min-w-[200px] flex-[2]">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Placa, marca, modelo o código…"
            />
          </FilterField>
          <FilterField label="Tipo">
            <Select
              name="type"
              defaultValue={typeValue}
              options={[
                { value: "", label: "Todas" },
                { value: "CHECK_OUT", label: "Solo salidas" },
                { value: "CHECK_IN", label: "Solo entradas" },
              ]}
            />
          </FilterField>
          <FilterField label="Vehículo" className="min-w-[220px] flex-[2]">
            <Select
              name="vehicleId"
              defaultValue={vehicleId}
              options={[
                { value: "", label: "Todos los vehículos" },
                ...vehicleOptions.map((v) => ({
                  value: v.id,
                  label: v.label,
                })),
              ]}
            />
          </FilterField>
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Filtrar
            </button>
          </div>
        </FilterBar>
      </form>

      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin inspecciones"
        emptyDescription="No hay inspecciones con esos filtros. Pruebe otra placa, tipo o vehículo."
        columns={[
          {
            key: "vehicle",
            header: "Vehículo",
            cell: (row) => (
              <div className="flex flex-col gap-0.5">
                <Link
                  href={`/dashboard/inspecciones/${row.id}`}
                  className="font-medium text-brand hover:underline"
                >
                  {row.vehicleLabel}
                </Link>
                <span className="text-xs text-muted">{row.code}</span>
              </div>
            ),
          },
          {
            key: "type",
            header: "Tipo",
            cell: (row) => INSPECTION_TYPE_LABELS[row.type] ?? row.type,
          },
          {
            key: "date",
            header: "Fecha",
            cell: (row) => formatAppDate(row.inspection_date),
          },
          {
            key: "mileage",
            header: "Km",
            cell: (row) =>
              row.mileage != null ? row.mileage.toLocaleString("es-SV") : "—",
            className: "hidden md:table-cell",
          },
          {
            key: "fuel",
            header: "Combustible",
            cell: (row) =>
              row.fuel_level
                ? (FUEL_LEVEL_LABELS[row.fuel_level] ?? row.fuel_level)
                : "—",
            className: "hidden lg:table-cell",
          },
          {
            key: "actions",
            header: "Acciones",
            cell: (row) => (
              <InspectionListActions
                inspectionId={row.id}
                inspectionCode={row.code}
              />
            ),
            className: "text-right",
          },
        ]}
      />

      {pageData ? (
        <Pagination
          page={pageData.page}
          totalPages={pageData.totalPages}
          basePath="/dashboard/inspecciones"
          searchParams={{
            q: q || undefined,
            type: typeValue || undefined,
            vehicleId: vehicleId || undefined,
          }}
        />
      ) : null}
    </ModuleListShell>
  );
}
