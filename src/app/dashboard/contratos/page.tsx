import Link from "next/link";

import { listContracts } from "@/app/dashboard/contratos/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatAppDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/env";

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const result = configured ? await listContracts(params) : null;
  const data = result?.success ? result.data.items : [];
  const error = result && !result.success ? result.error : null;

  return (
    <ModuleListShell
      title="Contratos"
      description="Contratos de arrendamiento generados y firmados."
      permission="contracts.view"
      configured={configured}
      error={error}
      count={data.length}
      countLabel="contratos mostrados"
      actions={
        <Link
          href="/dashboard/contratos/nuevo"
          className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Nuevo contrato
        </Link>
      }
    >
      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin contratos"
        emptyDescription="Genere contratos a partir de reservas confirmadas."
        columns={[
          {
            key: "code",
            header: "Código",
            cell: (row) => (
              <Link href={`/dashboard/contratos/${row.id}`} className="font-medium text-brand hover:underline">
                {row.code}
              </Link>
            ),
          },
          {
            key: "period",
            header: "Vigencia",
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
