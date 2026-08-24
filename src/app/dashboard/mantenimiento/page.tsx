import Link from "next/link";
import { Plus } from "lucide-react";

import { listMaintenanceRecords } from "@/app/dashboard/mantenimiento/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatAppDate } from "@/lib/dates";
import { MAINTENANCE_TYPE_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/env";

export default async function MantenimientoPage() {
  const configured = isSupabaseConfigured();
  const result = configured
    ? await listMaintenanceRecords({ pageSize: "100" })
    : null;

  const data = result?.success ? result.data.items : [];
  const error = result && !result.success ? result.error : null;

  return (
    <ModuleListShell
      title="Mantenimiento"
      description="Historial y programación de mantenimiento de la flota."
      permission="maintenance.view"
      configured={configured}
      error={error}
      count={data.length}
      countLabel="registros mostrados"
      actions={
        <Link href="/dashboard/mantenimiento/nuevo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo registro
          </Button>
        </Link>
      }
    >
      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin mantenimientos"
        emptyDescription="Programe servicios para mantener la flota operativa."
        columns={[
          {
            key: "vehicle",
            header: "Vehículo",
            cell: (row) =>
              row.vehicle
                ? `${row.vehicle.brand} ${row.vehicle.model}`
                : "—",
          },
          {
            key: "type",
            header: "Tipo",
            cell: (row) => MAINTENANCE_TYPE_LABELS[row.type],
          },
          {
            key: "description",
            header: "Descripción",
            cell: (row) => row.description,
            className: "max-w-xs truncate",
          },
          {
            key: "date",
            header: "Fecha",
            cell: (row) => formatAppDate(row.maintenance_date),
          },
          {
            key: "cost",
            header: "Costo",
            cell: (row) => formatMoney(row.cost),
            className: "hidden sm:table-cell",
          },
          {
            key: "status",
            header: "Estado",
            cell: (row) => <StatusBadge status={row.status} />,
          },
          {
            key: "actions",
            header: "",
            cell: (row) => (
              <Link
                href={`/dashboard/mantenimiento/${row.id}`}
                className="text-sm text-brand hover:underline"
              >
                Ver
              </Link>
            ),
          },
        ]}
      />
    </ModuleListShell>
  );
}
