import Link from "next/link";

import { listQuotes } from "@/app/dashboard/cotizaciones/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { ListFilters } from "@/components/dashboard/list-filters";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { QUOTE_STATUS_LABELS } from "@/lib/labels";
import { formatAppDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/env";

export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const result = configured ? await listQuotes(params) : null;
  const data = result?.success ? result.data.items : [];
  const error = result && !result.success ? result.error : null;

  const statusOptions = Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <ModuleListShell
      title="Cotizaciones"
      description="Cotizaciones generadas para clientes y solicitudes."
      permission="quotes.view"
      configured={configured}
      error={error}
      count={data.length}
      countLabel="cotizaciones mostradas"
      actions={
        <Link
          href="/dashboard/cotizaciones/nuevo"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Nueva cotización
        </Link>
      }
    >
      <form method="get" className="mb-4">
        <ListFilters
          q={String(params.q ?? "")}
          status={String(params.status ?? "")}
          statusOptions={statusOptions}
          searchPlaceholder="Código o nombre de cliente…"
        />
      </form>

      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin cotizaciones"
        emptyDescription="Cree cotizaciones a partir de solicitudes o clientes."
        columns={[
          {
            key: "code",
            header: "Código",
            cell: (row) => (
              <Link href={`/dashboard/cotizaciones/${row.id}`} className="font-medium hover:underline">
                {row.code}
              </Link>
            ),
          },
          {
            key: "customer",
            header: "Cliente",
            cell: (row) => row.customerName,
          },
          {
            key: "period",
            header: "Periodo",
            cell: (row) =>
              `${formatAppDate(row.start_at)} – ${formatAppDate(row.end_at)}`,
            className: "hidden md:table-cell",
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
