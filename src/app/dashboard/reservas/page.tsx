import Link from "next/link";

import { listReservations } from "@/app/dashboard/reservas/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { ListFilters } from "@/components/dashboard/list-filters";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { RESERVATION_STATUS_LABELS } from "@/lib/labels";
import { formatAppDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/env";

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const result = configured ? await listReservations(params) : null;
  const data = result?.success ? result.data.items : [];
  const error = result && !result.success ? result.error : null;

  const statusOptions = Object.entries(RESERVATION_STATUS_LABELS).map(
    ([value, label]) => ({ value, label }),
  );

  return (
    <ModuleListShell
      title="Reservas"
      description="Reservas confirmadas y en curso. Busque por nombre del cliente o código."
      permission="reservations.view"
      configured={configured}
      error={error}
      count={data.length}
      countLabel="reservas mostradas"
      actions={
        <Link
          href="/dashboard/reservas/nuevo"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Nueva reserva
        </Link>
      }
    >
      <form method="get" className="mb-4">
        <ListFilters
          q={String(params.q ?? "")}
          status={String(params.status ?? "")}
          statusOptions={statusOptions}
          searchPlaceholder="Nombre del cliente o código…"
        />
      </form>

      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin reservas"
        emptyDescription="Las reservas confirmadas se listarán aquí."
        columns={[
          {
            key: "customer",
            header: "Cliente",
            cell: (row) => (
              <Link
                href={`/dashboard/reservas/${row.id}`}
                className="font-medium hover:underline"
              >
                {row.customerName}
              </Link>
            ),
          },
          {
            key: "code",
            header: "Código",
            cell: (row) => (
              <span className="text-muted">{row.code}</span>
            ),
            className: "hidden sm:table-cell",
          },
          {
            key: "vehicle",
            header: "Vehículo",
            cell: (row) => row.vehicleLabel,
            className: "hidden md:table-cell",
          },
          {
            key: "period",
            header: "Periodo",
            cell: (row) =>
              `${formatAppDate(row.start_at)} – ${formatAppDate(row.end_at)}`,
          },
          {
            key: "total",
            header: "Total",
            cell: (row) => formatMoney(row.total),
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
