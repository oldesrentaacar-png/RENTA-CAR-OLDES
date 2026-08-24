"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney } from "@/lib/money";

type FinanceChartsProps = {
  chartData: Array<{ date: string; income: number; expense: number }>;
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow">
      <p className="font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-muted">
          {entry.dataKey === "income" ? "Ingresos" : "Gastos"}:{" "}
          {formatMoney(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function FinanceCharts({ chartData }: FinanceChartsProps) {
  const hasData = chartData.some((row) => row.income > 0 || row.expense > 0);

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimientos del periodo</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Sin movimientos"
            description="Registre ingresos y gastos para ver gráficos."
            className="py-10"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ingresos vs gastos (línea)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="income"
                name="Ingresos"
                stroke="#004A99"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="expense"
                name="Gastos"
                stroke="#D32F2F"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ingresos vs gastos (barras)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Bar dataKey="income" name="Ingresos" fill="#004A99" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Gastos" fill="#D32F2F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
