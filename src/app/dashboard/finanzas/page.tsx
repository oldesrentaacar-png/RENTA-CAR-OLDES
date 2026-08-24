import Link from "next/link";
import { Car, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { PermissionGuard } from "@/components/auth/permission-guard";
import { FinanceCharts } from "@/components/dashboard/finance-charts";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchFinanceSummary } from "@/app/dashboard/reportes/actions";
import { getMonthBounds } from "@/lib/calculations/profitability";
import { formatMoney } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/env";

export default async function FinanzasPage() {
  const configured = isSupabaseConfigured();
  const { from, to } = getMonthBounds();
  let error: string | null = null;
  let summary = {
    monthIncome: 0,
    monthExpenses: 0,
    net: 0,
    depositMetrics: { received: 0, returned: 0, retained: 0, applied: 0 },
    topVehicle: null as {
      vehicleLabel: string;
      utility: number;
    } | null,
    chartData: [] as Array<{ date: string; income: number; expense: number }>,
  };

  if (configured) {
    const result = await fetchFinanceSummary(from, to);
    if (result.success) {
      summary = result.data;
    } else {
      error = result.error;
    }
  }

  return (
    <PermissionGuard permission="finance.view">
      <div className="space-y-6">
        <PageHeader
          title="Finanzas"
          description="Resumen mensual de ingresos, gastos, depósitos y utilidad."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/ingresos/nuevo">
                <Button>Nuevo ingreso</Button>
              </Link>
              <Link href="/dashboard/gastos/nuevo">
                <Button variant="secondary">Nuevo gasto</Button>
              </Link>
              <Link href="/dashboard/ingresos">
                <Button variant="outline">Ver ingresos</Button>
              </Link>
              <Link href="/dashboard/gastos">
                <Button variant="outline">Ver gastos</Button>
              </Link>
            </div>
          }
        />

        {!configured ? <SetupBanner /> : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Ingresos del mes"
            value={formatMoney(summary.monthIncome)}
            subtitle="Utilidad real (sin depósitos reembolsables)"
            icon={TrendingUp}
          />
          <MetricCard
            title="Gastos del mes"
            value={formatMoney(summary.monthExpenses)}
            icon={TrendingDown}
          />
          <MetricCard
            title="Utilidad neta"
            value={formatMoney(summary.net)}
            icon={Wallet}
          />
          <MetricCard
            title="Vehículo más rentable"
            value={
              summary.topVehicle
                ? summary.topVehicle.vehicleLabel
                : "—"
            }
            subtitle={
              summary.topVehicle
                ? formatMoney(summary.topVehicle.utility)
                : "Sin datos suficientes"
            }
            icon={Car}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Depósitos recibidos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">
                {formatMoney(summary.depositMetrics.received)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Depósitos devueltos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">
                {formatMoney(summary.depositMetrics.returned)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Depósitos retenidos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">
                {formatMoney(summary.depositMetrics.retained)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Depósitos aplicados</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">
                {formatMoney(summary.depositMetrics.applied)}
              </p>
            </CardContent>
          </Card>
        </div>

        {configured && !error ? (
          <FinanceCharts chartData={summary.chartData} />
        ) : null}
      </div>
    </PermissionGuard>
  );
}
