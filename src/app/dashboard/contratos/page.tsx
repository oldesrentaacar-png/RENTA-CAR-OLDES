import Link from "next/link";

import { listContracts } from "@/app/dashboard/contratos/actions";
import { ListFilters } from "@/components/dashboard/list-filters";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge, getStatusLabel } from "@/components/shared/status-badge";
import { formatAppDate } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import type { ContractStatus } from "@/types/database";

const CONTRACT_STATUS_OPTIONS: Array<{ value: ContractStatus; label: string }> =
  [
    { value: "PENDING", label: getStatusLabel("PENDING") },
    { value: "CLIENT_SIGNED", label: getStatusLabel("CLIENT_SIGNED") },
    {
      value: "REPRESENTATIVE_SIGNED",
      label: getStatusLabel("REPRESENTATIVE_SIGNED"),
    },
    { value: "COMPLETED", label: getStatusLabel("COMPLETED") },
    { value: "CANCELLED", label: getStatusLabel("CANCELLED") },
  ];

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
      description="Contratos de arrendamiento. Busque por nombre del cliente o código."
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
      <form method="get" className="mb-4">
        <ListFilters
          q={String(params.q ?? "")}
          status={String(params.status ?? "")}
          statusOptions={CONTRACT_STATUS_OPTIONS}
          searchPlaceholder="Nombre del cliente o código…"
        />
      </form>

      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin contratos"
        emptyDescription="Genere contratos a partir de reservas confirmadas."
        columns={[
          {
            key: "customer",
            header: "Cliente",
            cell: (row) => (
              <Link
                href={`/dashboard/contratos/${row.id}`}
                className="font-medium text-brand hover:underline"
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
            header: "Vigencia",
            cell: (row) =>
              `${formatAppDate(row.start_at)} – ${formatAppDate(row.end_at)}`,
            className: "hidden lg:table-cell",
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
