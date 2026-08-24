import { fetchReportData } from "@/app/dashboard/reportes/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { ReportesClient } from "@/components/dashboard/reportes-client";
import { isSupabaseConfigured } from "@/lib/env";

export default async function ReportesPage() {
  const configured = isSupabaseConfigured();
  const year = new Date().getFullYear();
  const defaultFrom = `${year}-01-01`;
  const defaultTo = `${year}-12-31`;
  const result = configured
    ? await fetchReportData({ from: defaultFrom, to: defaultTo })
    : null;
  const error = result && !result.success ? result.error : null;

  const emptyData = {
    incomes: [],
    expenses: [],
    reservations: [],
    maintenance: [],
    vehicles: [],
    summary: {
      totalRealIncome: 0,
      totalExpenses: 0,
      netUtility: 0,
      subleaseProviderCost: 0,
      depositMetrics: { received: 0, returned: 0, retained: 0, applied: 0 },
      reservationCount: 0,
      completedReservations: 0,
      occupancyRate: 0,
      maintenanceCost: 0,
    },
    profitability: [],
    subleaseReport: [],
  };

  return (
    <ModuleListShell
      title="Reportes"
      description="Resúmenes financieros y operativos exportables."
      permission="reports.view"
      configured={configured}
      error={error}
      count={
        result?.success
          ? result.data.incomes.length + result.data.expenses.length
          : 0
      }
      countLabel="movimientos analizados"
    >
      {result?.success ? (
        <ReportesClient
          initialData={result.data}
          initialFrom={defaultFrom}
          initialTo={defaultTo}
        />
      ) : configured && !error ? (
        <ReportesClient
          initialData={emptyData}
          initialFrom={defaultFrom}
          initialTo={defaultTo}
        />
      ) : null}
    </ModuleListShell>
  );
}
