import Link from "next/link";
import {
  DollarSign,
  Handshake,
  Pencil,
  TrendingDown,
  TrendingUp,
  Truck,
} from "lucide-react";

import { getBalanceDashboard } from "@/app/dashboard/balance/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { BalanceCharts } from "@/components/dashboard/balance-charts";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { toUserMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import type { BalanceDashboardData } from "@/app/dashboard/balance/actions";

export default async function BalancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  let summary: BalanceDashboardData | null = null;
  let error: string | null = null;

  if (configured) {
    try {
      const result = await getBalanceDashboard(params);
      if (result.success) summary = result.data;
      else error = result.error;
    } catch (err) {
      error = toUserMessage(err);
    }
  }

  const month =
    summary?.month ??
    String(params.month ?? new Date().toISOString().slice(0, 7));

  return (
    <PermissionGuard permission="finance.view">
      <div className="space-y-6">
        <PageHeader
          title="Mi balance"
          description="Resumen mensual de utilidad real del negocio, con gráficos y accesos para editar."
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

        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/liquidacion?month=${month}`}>
            <Button variant="secondary" type="button">
              <Pencil className="mr-2 h-4 w-4" />
              Editar liquidaciones
            </Button>
          </Link>
          <Link href="/dashboard/socios">
            <Button variant="secondary" type="button">
              <Handshake className="mr-2 h-4 w-4" />
              Editar socios
            </Button>
          </Link>
          <Link href="/dashboard/proveedores">
            <Button variant="secondary" type="button">
              <Truck className="mr-2 h-4 w-4" />
              Editar proveedores
            </Button>
          </Link>
          <Link href="/dashboard/gastos">
            <Button variant="secondary" type="button">
              <TrendingDown className="mr-2 h-4 w-4" />
              Editar gastos
            </Button>
          </Link>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Los totales de contratos representan facturación bruta. La utilidad neta
          real descuenta costos de liquidación, pagos a proveedores, gastos
          operativos y separa las ganancias de socios.
        </div>

        {summary ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                title="Facturado"
                value={formatMoney(summary.billedAmount)}
                icon={DollarSign}
              />
              <MetricCard
                title="Ganancia liquidación"
                value={formatMoney(summary.settlementProfit)}
                icon={TrendingUp}
              />
              <MetricCard
                title="Ganancia socios"
                value={formatMoney(summary.partnerProfit)}
                icon={Handshake}
              />
              <MetricCard
                title="Pagos a proveedores"
                value={formatMoney(summary.vendorPayments)}
                icon={Truck}
              />
              <MetricCard
                title="Gastos operativos"
                value={formatMoney(summary.operatingExpenses)}
                icon={TrendingDown}
              />
              <MetricCard
                title="Ganancia neta real"
                value={formatMoney(summary.realNetProfit)}
                icon={DollarSign}
                className="border-brand"
              />
            </div>

            <BalanceCharts data={summary} />
          </>
        ) : null}
      </div>
    </PermissionGuard>
  );
}
