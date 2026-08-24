import Link from "next/link";

import { listInspections } from "@/app/dashboard/inspecciones/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { DataTable } from "@/components/shared/data-table";
import { FUEL_LEVEL_LABELS, INSPECTION_TYPE_LABELS } from "@/lib/inspections/defaults";
import { formatAppDate } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";

export default async function InspeccionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const result = configured ? await listInspections(params) : null;
  const data = result?.success ? result.data.items : [];
  const error = result && !result.success ? result.error : null;

  return (
    <ModuleListShell
      title="Inspecciones"
      description="Inspecciones de salida y entrada de vehículos."
      permission="inspections.view"
      configured={configured}
      error={error}
      count={data.length}
      countLabel="inspecciones mostradas"
      actions={
        <Link
          href="/dashboard/inspecciones/nuevo"
          className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Nueva inspección
        </Link>
      }
    >
      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin inspecciones"
        emptyDescription="Registre inspecciones al entregar o recibir vehículos."
        columns={[
          {
            key: "code",
            header: "Código",
            cell: (row) => (
              <Link
                href={`/dashboard/inspecciones/${row.id}`}
                className="font-medium text-brand hover:underline"
              >
                {row.code}
              </Link>
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
        ]}
      />
    </ModuleListShell>
  );
}
