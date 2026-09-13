"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { BalanceDashboardData } from "@/app/dashboard/balance/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney } from "@/lib/money";

const COLORS = ["#004A99", "#16a34a", "#D32F2F", "#ca8a04", "#0284c7", "#64748b"];

type BalanceChartsProps = {
  data: BalanceDashboardData;
};

function MoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow">
      {label ? <p className="mb-1 font-medium">{label}</p> : null}
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="text-muted">
          {entry.name}: {formatMoney(Number(entry.value ?? 0))}
        </p>
      ))}
    </div>
  );
}

export function BalanceCharts({ data }: BalanceChartsProps) {
  const composition = data.composition.filter((item) => item.value > 0);
  const hasMonthData = data.breakdown.some((item) => item.value !== 0);
  const hasTrend = data.trend.some(
    (row) =>
      row.billed > 0 ||
      row.profit > 0 ||
      row.costs > 0 ||
      row.net !== 0,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Composición del mes</CardTitle>
        </CardHeader>
        <CardContent>
          {composition.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={composition}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {composition.map((_, index) => (
                    <Cell
                      key={`comp-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<MoneyTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              title="Sin composición"
              description="Registre liquidaciones, socios, pagos o gastos del mes."
              className="py-10"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desglose del mes (barras)</CardTitle>
        </CardHeader>
        <CardContent>
          {hasMonthData ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.breakdown} margin={{ bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<MoneyTooltip />} />
                <Bar dataKey="value" name="Monto" radius={[4, 4, 0, 0]}>
                  {data.breakdown.map((entry, index) => (
                    <Cell
                      key={`bar-${entry.name}`}
                      fill={entry.color ?? COLORS[index % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              title="Sin desglose"
              description="Aún no hay montos para graficar este mes."
              className="py-10"
            />
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">
            Tendencia 6 meses (líneas)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasTrend ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<MoneyTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="billed"
                  name="Facturado"
                  stroke="#004A99"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Ganancias"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="costs"
                  name="Costos/pagos"
                  stroke="#D32F2F"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  name="Neto real"
                  stroke="#ca8a04"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              title="Sin tendencia"
              description="Cuando haya movimientos en varios meses verá la evolución aquí."
              className="py-10"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
