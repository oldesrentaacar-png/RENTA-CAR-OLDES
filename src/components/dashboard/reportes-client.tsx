"use client";

import { useMemo, useState, useTransition } from "react";
import { Download } from "lucide-react";

import { fetchReportData, type ReportData } from "@/app/dashboard/reportes/actions";
import { DataTable } from "@/components/shared/data-table";
import { VehicleComparisonChart } from "@/components/dashboard/vehicle-comparison-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  EXPENSE_CATEGORY_LABELS,
  INCOME_TYPE_LABELS,
  MAINTENANCE_TYPE_LABELS,
  RESERVATION_STATUS_LABELS,
} from "@/lib/labels";
import { formatAppDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob([`\uFEFF${content}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type ReportesClientProps = {
  initialData: ReportData;
  initialFrom?: string;
  initialTo?: string;
  initialVehicleId?: string;
  initialCategory?: string;
};

export function ReportesClient({
  initialData,
  initialFrom = "",
  initialTo = "",
  initialVehicleId = "",
  initialCategory = "",
}: ReportesClientProps) {
  const [data, setData] = useState(initialData);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const [category, setCategory] = useState(initialCategory);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const applyFilters = () => {
    startTransition(async () => {
      setError(null);
      const result = await fetchReportData({
        from: from || undefined,
        to: to || undefined,
        vehicleId: vehicleId || undefined,
        category: category || undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setData(result.data);
    });
  };

  const exportIncomes = () => {
    downloadCsv("ingresos.csv", [
      ["Fecha", "Tipo", "Monto", "Método", "Referencia"],
      ...data.incomes.map((row) => [
        row.transaction_date,
        INCOME_TYPE_LABELS[row.type],
        String(row.amount),
        row.payment_method,
        row.reference ?? "",
      ]),
    ]);
  };

  const exportExpenses = () => {
    downloadCsv("gastos.csv", [
      ["Fecha", "Concepto", "Categoría", "Monto", "Proveedor"],
      ...data.expenses.map((row) => [
        row.expense_date,
        row.concept,
        EXPENSE_CATEGORY_LABELS[row.category],
        String(row.amount),
        row.provider ?? "",
      ]),
    ]);
  };

  const exportProfitability = () => {
    downloadCsv("rentabilidad.csv", [
      ["Vehículo", "Ingresos reales", "Gastos", "Utilidad", "Días renta"],
      ...data.profitability.map((row) => [
        row.vehicleLabel,
        String(row.realIncome),
        String(row.expenses),
        String(row.utility),
        String(row.rentalDays),
      ]),
    ]);
  };

  const summaryCards = useMemo(
    () => [
      { title: "Ingresos reales", value: formatMoney(data.summary.totalRealIncome) },
      { title: "Gastos", value: formatMoney(data.summary.totalExpenses) },
      {
        title: "Costo proveedores (subarrendo)",
        value: formatMoney(data.summary.subleaseProviderCost ?? 0),
      },
      { title: "Utilidad neta real", value: formatMoney(data.summary.netUtility) },
      { title: "Reservas", value: String(data.summary.reservationCount) },
      { title: "Ocupación flota", value: `${data.summary.occupancyRate}%` },
      { title: "Costo mantenimiento", value: formatMoney(data.summary.maintenanceCost) },
    ],
    [data],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Input label="Desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label="Hasta" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <Select
              label="Vehículo"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              options={[
                { value: "", label: "Todos" },
                ...data.vehicles.map((v) => ({ value: v.id, label: v.label })),
              ]}
            />
            <Select
              label="Categoría gasto"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={[
                { value: "", label: "Todas" },
                ...Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
            />
            <div className="flex items-end">
              <Button type="button" onClick={applyFilters} disabled={pending} className="w-full">
                {pending ? "Aplicando…" : "Aplicar filtros"}
              </Button>
            </div>
          </div>
          {error ? (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardTitle className="text-base">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Comparación anual de vehículos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <VehicleComparisonChart data={data.profitability} />
        </CardContent>
      </Card>

      {data.subleaseReport.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Subarrendados — ganancia real vs costo a terceros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={data.subleaseReport}
              getRowKey={(row) => row.vehicleId}
              emptyTitle="Sin subarrendados"
              emptyDescription="Configure vehículos subarrendados con costo diario."
              columns={[
                { key: "vehicle", header: "Vehículo", cell: (row) => row.vehicleLabel },
                { key: "payee", header: "Destinatario", cell: (row) => row.payeeName },
                {
                  key: "daily",
                  header: "Costo/día",
                  cell: (row) => formatMoney(row.dailyCost),
                },
                { key: "days", header: "Días renta", cell: (row) => row.rentalDays },
                {
                  key: "sublease",
                  header: "Total a tercero",
                  cell: (row) => formatMoney(row.subleaseTotal),
                },
                {
                  key: "income",
                  header: "Ingresos",
                  cell: (row) => formatMoney(row.realIncome),
                },
                {
                  key: "net",
                  header: "Utilidad real",
                  cell: (row) => formatMoney(row.netRealUtility),
                },
              ]}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Ranking de rentabilidad</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={exportProfitability}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            data={data.profitability}
            getRowKey={(row) => row.vehicleId}
            emptyTitle="Sin datos"
            emptyDescription="No hay rentabilidad calculada para los filtros seleccionados."
            columns={[
              { key: "vehicle", header: "Vehículo", cell: (row) => row.vehicleLabel },
              {
                key: "income",
                header: "Ingresos",
                cell: (row) => formatMoney(row.realIncome),
              },
              {
                key: "expenses",
                header: "Gastos",
                cell: (row) => formatMoney(row.expenses),
              },
              {
                key: "utility",
                header: "Utilidad",
                cell: (row) => formatMoney(row.utility),
              },
              {
                key: "days",
                header: "Días renta",
                cell: (row) => row.rentalDays,
              },
            ]}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Ingresos</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={exportIncomes}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          </CardHeader>
          <CardContent>
            <DataTable
              data={data.incomes.slice(0, 50)}
              getRowKey={(row) => row.id}
              emptyTitle="Sin ingresos"
              emptyDescription="No hay ingresos en el periodo."
              columns={[
                {
                  key: "date",
                  header: "Fecha",
                  cell: (row) => formatAppDate(row.transaction_date),
                },
                {
                  key: "type",
                  header: "Tipo",
                  cell: (row) => (
                    <Badge variant="brand">{INCOME_TYPE_LABELS[row.type]}</Badge>
                  ),
                },
                {
                  key: "amount",
                  header: "Monto",
                  cell: (row) => formatMoney(row.amount),
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Gastos</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={exportExpenses}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          </CardHeader>
          <CardContent>
            <DataTable
              data={data.expenses.slice(0, 50)}
              getRowKey={(row) => row.id}
              emptyTitle="Sin gastos"
              emptyDescription="No hay gastos en el periodo."
              columns={[
                {
                  key: "date",
                  header: "Fecha",
                  cell: (row) => formatAppDate(row.expense_date),
                },
                { key: "concept", header: "Concepto", cell: (row) => row.concept },
                {
                  key: "amount",
                  header: "Monto",
                  cell: (row) => formatMoney(row.amount),
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reservas y mantenimiento</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <DataTable
            data={data.reservations.slice(0, 30)}
            getRowKey={(row) => row.id}
            emptyTitle="Sin reservas"
            emptyDescription="No hay reservas en el periodo."
            columns={[
              { key: "code", header: "Código", cell: (row) => row.code },
              {
                key: "status",
                header: "Estado",
                cell: (row) => RESERVATION_STATUS_LABELS[row.status],
              },
              {
                key: "start",
                header: "Inicio",
                cell: (row) => formatAppDate(row.start_at.slice(0, 10)),
              },
            ]}
          />
          <DataTable
            data={data.maintenance.slice(0, 30)}
            getRowKey={(row) => row.id}
            emptyTitle="Sin mantenimientos"
            emptyDescription="No hay mantenimientos en el periodo."
            columns={[
              {
                key: "type",
                header: "Tipo",
                cell: (row) => MAINTENANCE_TYPE_LABELS[row.type],
              },
              {
                key: "date",
                header: "Fecha",
                cell: (row) => formatAppDate(row.maintenance_date),
              },
              {
                key: "cost",
                header: "Costo",
                cell: (row) => formatMoney(row.cost),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
