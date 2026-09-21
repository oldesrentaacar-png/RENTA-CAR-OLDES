import Link from "next/link";

import { listContracts } from "@/app/dashboard/contratos/actions";
import { ListFilters } from "@/components/dashboard/list-filters";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/shared/pagination";
import {
  CONTRACT_DISPLAY_PHASE_OPTIONS,
  contractDisplayPhaseBadgeVariant,
} from "@/lib/contracts/display-phase";
import { formatAppDate } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const result = configured ? await listContracts(params) : null;
  const pageData = result?.success ? result.data : null;
  const data = pageData?.items ?? [];
  const error = result && !result.success ? result.error : null;

  return (
    <ModuleListShell
      title="Contratos"
      description="Contratos de arrendamiento. Estado operativo: En curso, Sin resolver, Finalizado o Anulado."
      permission="contracts.view"
      configured={configured}
      error={error}
      count={pageData?.total ?? data.length}
      countLabel="contratos"
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
          statusOptions={CONTRACT_DISPLAY_PHASE_OPTIONS}
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
            cell: (row) => (
              <Badge
                variant={contractDisplayPhaseBadgeVariant(row.displayPhase)}
              >
                {row.displayPhaseLabel}
              </Badge>
            ),
          },
        ]}
      />

      {pageData ? (
        <Pagination
          page={pageData.page}
          totalPages={pageData.totalPages}
          basePath="/dashboard/contratos"
          searchParams={{
            q: String(params.q ?? "") || undefined,
            status: String(params.status ?? "") || undefined,
          }}
        />
      ) : null}
    </ModuleListShell>
  );
}
