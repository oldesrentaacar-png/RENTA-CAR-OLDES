import Link from "next/link";
import { notFound } from "next/navigation";

import { getMaintenanceRecord } from "@/app/dashboard/mantenimiento/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { MaintenanceForm } from "@/components/forms/maintenance-form";
import { MaintenanceStatusActions } from "@/app/dashboard/mantenimiento/maintenance-status-actions";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  listMaintenanceVehicles,
} from "@/app/dashboard/mantenimiento/actions";
import { formatAppDate } from "@/lib/dates";
import {
  MAINTENANCE_STATUS_LABELS,
  MAINTENANCE_TYPE_LABELS,
} from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/env";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MantenimientoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const configured = isSupabaseConfigured();

  if (!configured) {
    return (
      <PermissionGuard permission="maintenance.view">
        <div className="space-y-6">
          <PageHeader title="Mantenimiento" description="Detalle del registro." />
          <SetupBanner />
        </div>
      </PermissionGuard>
    );
  }

  const [recordResult, vehiclesResult] = await Promise.all([
    getMaintenanceRecord(id),
    listMaintenanceVehicles(),
  ]);

  if (!recordResult.success) {
    notFound();
  }

  const record = recordResult.data;
  const vehicles = vehiclesResult.success ? vehiclesResult.data : [];

  return (
    <PermissionGuard permission="maintenance.view">
      <div className="space-y-6">
        <PageHeader
          title="Detalle de mantenimiento"
          description={record.description}
          breadcrumbs={[
            { label: "Mantenimiento", href: "/dashboard/mantenimiento" },
            { label: MAINTENANCE_TYPE_LABELS[record.type] },
          ]}
          actions={
            <Link
              href="/dashboard/mantenimiento"
              className="text-sm text-brand hover:underline"
            >
              Volver al listado
            </Link>
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <StatusBadge status={record.status} />
              <p className="text-sm text-muted">
                {MAINTENANCE_STATUS_LABELS[record.status]}
              </p>
              <MaintenanceStatusActions
                id={record.id}
                currentStatus={record.status}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vehículo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">
                {record.vehicle
                  ? `${record.vehicle.brand} ${record.vehicle.model} (${record.vehicle.plate})`
                  : "—"}
              </p>
              {record.vehicle ? (
                <p className="mt-1 text-sm text-muted">
                  Estado flota: {record.vehicle.status}
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Costos y fechas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                <span className="text-muted">Fecha:</span>{" "}
                {formatAppDate(record.maintenance_date)}
              </p>
              <p>
                <span className="text-muted">Costo:</span>{" "}
                {formatMoney(record.cost)}
              </p>
              {record.next_date ? (
                <p>
                  <span className="text-muted">Próxima fecha:</span>{" "}
                  {formatAppDate(record.next_date)}
                </p>
              ) : null}
              {record.next_mileage ? (
                <p>
                  <span className="text-muted">Próximo km:</span>{" "}
                  {record.next_mileage.toLocaleString()} km
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <PermissionGuard permission="maintenance.edit">
          <div>
            <h2 className="mb-4 text-lg font-semibold">Editar registro</h2>
            <MaintenanceForm
              record={record}
              vehicles={vehicles}
              redirectTo={`/dashboard/mantenimiento/${record.id}`}
            />
          </div>
        </PermissionGuard>
      </div>
    </PermissionGuard>
  );
}
