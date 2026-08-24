"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { getStatusLabel } from "@/components/shared/status-badge";

const CHART_COLORS = ["#004A99", "#D32F2F", "#16a34a", "#ca8a04", "#0284c7", "#64748b"];

type ChartDataPoint = { status: string; count: number };

export function DashboardCharts({
  vehiclesByStatus,
  requestsByStatus,
}: {
  vehiclesByStatus: ChartDataPoint[];
  requestsByStatus: ChartDataPoint[];
}) {
  const vehicleData = vehiclesByStatus.map((item) => ({
    name: getStatusLabel(item.status),
    value: item.count,
  }));

  const requestData = requestsByStatus.map((item) => ({
    name: getStatusLabel(item.status),
    count: item.count,
  }));

  const hasVehicleData = vehicleData.some((item) => item.value > 0);
  const hasRequestData = requestData.some((item) => item.count > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Flota por estado</CardTitle>
        </CardHeader>
        <CardContent>
          {hasVehicleData ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={vehicleData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {vehicleData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              title="Sin datos de flota"
              description="Agregue vehículos para ver la distribución por estado."
              className="py-10"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solicitudes por estado</CardTitle>
        </CardHeader>
        <CardContent>
          {hasRequestData ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={requestData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#004A99" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              title="Sin solicitudes"
              description="Las solicitudes web aparecerán aquí cuando existan registros."
              className="py-10"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
