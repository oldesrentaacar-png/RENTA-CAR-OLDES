import { DollarSign } from "lucide-react";

import { getBalanceSummary } from "@/app/dashboard/balance/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export default async function BalancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const result = configured ? await getBalanceSummary(params) : null;
  const summary = result?.success ? result.data : null;
  const month = summary?.month ?? String(params.month ?? new Date().toISOString().slice(0, 7));
  const error = result && !result.success ? result.error : null;

  return (
    <PermissionGuard permission="finance.view">
      <div className="space-y-6">
        <PageHeader
          title="Mi balance"
          description="Resumen mensual de utilidad real del negocio."
        />

        {!configured ? <SetupBanner /> : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <form method="get" className="flex flex-wrap items-end gap-3">
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

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Los totales de contratos representan facturación bruta. La utilidad neta
          real descuenta costos de liquidación, pagos a proveedores, gastos
          operativos y separa las ganancias de socios.
        </div>

        {summary ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title="Facturado"
              value={formatMoney(summary.billedAmount)}
              icon={DollarSign}
            />
            <MetricCard
              title="Ganancia liquidación"
              value={formatMoney(summary.settlementProfit)}
              icon={DollarSign}
            />
            <MetricCard
              title="Ganancia socios"
              value={formatMoney(summary.partnerProfit)}
              icon={DollarSign}
            />
            <MetricCard
              title="Pagos a proveedores"
              value={formatMoney(summary.vendorPayments)}
              icon={DollarSign}
            />
            <MetricCard
              title="Gastos operativos"
              value={formatMoney(summary.operatingExpenses)}
              icon={DollarSign}
            />
            <MetricCard
              title="Ganancia neta real"
              value={formatMoney(summary.realNetProfit)}
              icon={DollarSign}
              className="border-brand"
            />
          </div>
        ) : null}
      </div>
    </PermissionGuard>
  );
}
