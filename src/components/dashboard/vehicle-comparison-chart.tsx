"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { VehicleProfitability } from "@/lib/calculations/profitability";
import { formatMoney } from "@/lib/money";

type VehicleComparisonChartProps = {
  data: VehicleProfitability[];
  title?: string;
};

export function VehicleComparisonChart({
  data,
  title = "Comparación de vehículos (días rentados vs ingresos)",
}: VehicleComparisonChartProps) {
  const chartData = [...data]
    .sort((a, b) => b.realIncome - a.realIncome)
    .slice(0, 12)
    .map((row) => ({
      name: row.vehicleLabel.length > 18
        ? `${row.vehicleLabel.slice(0, 16)}…`
        : row.vehicleLabel,
      fullName: row.vehicleLabel,
      rentalDays: row.rentalDays,
      income: row.realIncome,
    }));

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-muted">
        No hay datos de vehículos para el periodo seleccionado.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-zinc-900">{title}</p>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              angle={-25}
              textAnchor="end"
              height={60}
              interval={0}
              tick={{ fontSize: 11 }}
            />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === "income") return [formatMoney(Number(value)), "Ingresos"];
                return [String(value), "Días rentados"];
              }}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.fullName ?? ""
              }
            />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="rentalDays"
              name="Días rentados"
              fill="#0A1F5C"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              yAxisId="right"
              dataKey="income"
              name="Ingresos"
              fill="#E30613"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
