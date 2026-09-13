import Link from "next/link";
import { Plus } from "lucide-react";

import { listMonthlySettlements } from "@/app/dashboard/liquidacion/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { FinanceDeleteButton } from "@/components/finance/finance-delete-button";
import { DataTable } from "@/components/shared/data-table";
import { MetricCard } from "@/components/shared/metric-card";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { formatAppDate } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export default async function LiquidacionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const user = configured ? await getCurrentUser() : null;
  const canDelete = user ? await hasPermission(user.id, "finance.delete") : false;
  const result = configured ? await listMonthlySettlements(params) : null;
  const data = result?.success ? result.data.items : [];
  const totals = result?.success
    ? result.data.totals
    : { billedAmount: 0, providerCost: 0, extraCosts: 0, ownProfit: 0 };
  const month = result?.success
    ? result.data.month
    : String(params.month ?? new Date().toISOString().slice(0, 7));
  const error = result && !result.success ? result.error : null;

  return (
    <ModuleListShell
      title="Liquidación mensual"
      description="Control de facturación, costos de terceros y ganancia real por contrato."
      permission="finance.view"
      configured={configured}
      error={error}
      count={data.length}
      countLabel="liquidaciones mostradas"
      actions={
        <Link href="/dashboard/liquidacion/nuevo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nueva liquidación
          </Button>
        </Link>
      }
    >
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">Mes</span>
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="h-10 rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
        </label>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin liquidaciones"
        emptyDescription="Registre liquidaciones mensuales por contrato para ver la ganancia real."
        columns={[
          {
            key: "contract",
            header: "Contrato",
            cell: (row) => row.contract_code ?? "Manual",
          },
          {
            key: "customer",
            header: "Cliente",
            cell: (row) => row.customer_name ?? "—",
          },
          {
            key: "vehicle",
            header: "Vehículo",
            cell: (row) =>
              [row.vehicle_label, row.plate ? `(${row.plate})` : null]
                .filter(Boolean)
                .join(" ") || "—",
            className: "hidden md:table-cell",
          },
          {
            key: "period",
            header: "Periodo",
            cell: (row) =>
              row.start_at && row.end_at
                ? `${formatAppDate(row.start_at)} - ${formatAppDate(row.end_at)}`
                : formatAppDate(row.period_month),
            className: "hidden lg:table-cell",
          },
          {
            key: "billed",
            header: "Facturado",
            cell: (row) => formatMoney(row.billed_amount),
          },
          {
            key: "provider",
            header: "Terceros",
            cell: (row) => formatMoney(row.provider_cost),
          },
          {
            key: "profit",
            header: "Ganancia",
            cell: (row) => formatMoney(row.own_profit),
          },
          {
            key: "actions",
            header: "",
            cell: (row) =>
              canDelete ? (
                <FinanceDeleteButton
                  target="settlement"
                  id={row.id}
                  label="¿Eliminar esta liquidación?"
                />
              ) : null,
            className: "w-[72px]",
          },
        ]}
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Facturado" value={formatMoney(totals.billedAmount)} />
        <MetricCard
          title="Pagado terceros"
          value={formatMoney(totals.providerCost)}
        />
        <MetricCard title="Costos extra" value={formatMoney(totals.extraCosts)} />
        <MetricCard
          title="Ganancia real"
          value={formatMoney(totals.ownProfit)}
        />
      </div>
    </ModuleListShell>
  );
}
