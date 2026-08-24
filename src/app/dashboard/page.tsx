import Link from "next/link";
import {
  Calendar,
  Car,
  ClipboardList,
  DollarSign,
  Users,
  Bell,
  FileText,
  ArrowRightLeft,
  AlertTriangle,
} from "lucide-react";

import { PermissionGuard } from "@/components/auth/permission-guard";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  agendaTimeLabel,
  fetchDashboardMetrics,
  fetchDashboardOpsAgenda,
  type OpsAgendaItem,
  type OpsOpenContract,
  type OpsPendingRequest,
} from "@/lib/dashboard/data";
import {
  appLocalDateTimeToUtc,
  formatAppDate,
  formatAppDateTime,
} from "@/lib/dates";
import { formatMoney } from "@/lib/money";

function formatAgendaDay(ymd: string): string {
  return formatAppDate(appLocalDateTimeToUtc(ymd, "12:00"));
}

function AgendaEmpty({ message }: { message: string }) {
  return <p className="text-sm text-muted">{message}</p>;
}

function ReservationAgendaList({
  items,
  timeField = "start_at",
}: {
  items: OpsAgendaItem[];
  timeField?: "start_at" | "end_at";
}) {
  if (items.length === 0) {
    return <AgendaEmpty message="Sin movimientos en este periodo." />;
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0 space-y-0.5">
            <Link
              href={item.href}
              className="font-medium text-zinc-900 hover:underline touch-manipulation"
            >
              {item.code} · {item.customerName}
            </Link>
            <p className="truncate text-xs text-muted">
              {item.vehicleLabel} · {agendaTimeLabel(item[timeField])}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <StatusBadge status={item.status} />
            <Link
              href={`/dashboard/contratos/nuevo?reservation_id=${item.id}`}
              className="inline-flex min-h-9 items-center text-sm font-medium text-brand hover:underline touch-manipulation"
            >
              Generar contrato
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PendingRequestsList({
  items,
  total,
}: {
  items: OpsPendingRequest[];
  total: number;
}) {
  if (items.length === 0) {
    return <AgendaEmpty message="No hay solicitudes pendientes." />;
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0 space-y-0.5">
              <Link
                href={item.href}
                className="font-medium text-zinc-900 hover:underline"
              >
                {item.code} · {item.name}
              </Link>
              <p className="text-xs text-muted">Recogida: {item.pickupLabel}</p>
            </div>
          </li>
        ))}
      </ul>
      {total > items.length ? (
        <Link
          href="/dashboard/solicitudes?status=PENDING"
          className="inline-flex text-sm font-medium text-brand hover:underline"
        >
          Ver las {total} pendientes
        </Link>
      ) : (
        <Link
          href="/dashboard/solicitudes?status=PENDING"
          className="inline-flex text-sm font-medium text-brand hover:underline"
        >
          Ver solicitudes
        </Link>
      )}
    </div>
  );
}

function OpenContractsList({
  items,
  showCloseLink,
}: {
  items: OpsOpenContract[];
  showCloseLink?: boolean;
}) {
  if (items.length === 0) {
    return <AgendaEmpty message="No hay contratos en esta lista." />;
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0 space-y-0.5">
            <Link
              href={item.href}
              className="font-medium text-zinc-900 hover:underline touch-manipulation"
            >
              {item.code} · {item.customerName}
            </Link>
            <p className="truncate text-xs text-muted">
              {item.vehicleLabel} · fin {formatAppDateTime(item.end_at)}
            </p>
            {item.isOverdue ? (
              <p className="text-xs font-medium text-amber-800">
                Fecha de fin vencida — revisar cierre
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <StatusBadge status={item.status} />
            {showCloseLink ? (
              <Link
                href={item.href}
                className="text-xs font-medium text-brand hover:underline"
              >
                Cerrar
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  const [metrics, agenda] = await Promise.all([
    fetchDashboardMetrics(),
    fetchDashboardOpsAgenda(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel de control"
        description="Agenda operativa del día y resumen de su negocio de renta."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/contratos/nuevo"
              className="inline-flex min-h-11 items-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 touch-manipulation"
            >
              Generar contrato
            </Link>
            <Link
              href="/dashboard/contratos"
              className="inline-flex min-h-11 items-center rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 touch-manipulation"
            >
              Cerrar / ver contratos
            </Link>
          </div>
        }
      />

      {!metrics.configured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase no está configurado. Configure las variables de entorno para
          ver métricas en tiempo real. Mientras tanto puede explorar la interfaz
          del panel.
        </div>
      ) : null}

      {metrics.error || agenda.error ? (
        <ErrorState
          title="No se pudieron cargar los datos del panel"
          message={metrics.error ?? agenda.error ?? "Error desconocido"}
        />
      ) : null}

      {/* §14 Operational agenda — prioritized above charts */}
      {agenda.configured && !agenda.error ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                Agenda operativa
              </h2>
              <p className="text-sm text-muted">
                Hoy {formatAgendaDay(agenda.todayLabel)} · mañana{" "}
                {formatAgendaDay(agenda.tomorrowLabel)} (El Salvador)
              </p>
            </div>
            <Link
              href="/dashboard/calendario"
              className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline touch-manipulation"
            >
              Abrir calendario
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Pendientes del día</CardTitle>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                  {agenda.pendingRequestsCount}
                </span>
              </CardHeader>
              <CardContent>
                <PendingRequestsList
                  items={agenda.pendingRequests}
                  total={agenda.pendingRequestsCount}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-muted" />
                  Reservas de hoy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReservationAgendaList items={agenda.reservationsToday} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-muted" />
                  Reservas de mañana
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReservationAgendaList items={agenda.reservationsTomorrow} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Car className="h-4 w-4 text-muted" />
                  Vehículos a entregar hoy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReservationAgendaList items={agenda.deliveriesToday} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowRightLeft className="h-4 w-4 text-muted" />
                  Vehículos a recibir hoy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReservationAgendaList
                  items={agenda.returnsToday}
                  timeField="end_at"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-muted" />
                  Contratos abiertos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <OpenContractsList items={agenda.openContracts} showCloseLink />
              </CardContent>
            </Card>
          </div>

          {agenda.openContractAlerts.length > 0 ? (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-amber-950">
                  <AlertTriangle className="h-4 w-4" />
                  Alertas de contratos abiertos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-amber-900">
                  Contratos cuya fecha de fin ya pasó y siguen sin completar o
                  cancelar.
                </p>
                <OpenContractsList
                  items={agenda.openContractAlerts}
                  showCloseLink
                />
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          title="Solicitudes pendientes"
          value={metrics.pendingRequests}
          icon={ClipboardList}
        />
        <MetricCard
          title="Reservas activas"
          value={metrics.activeReservations}
          icon={Calendar}
        />
        <MetricCard
          title="Vehículos disponibles"
          value={metrics.availableVehicles}
          icon={Car}
        />
        <MetricCard
          title="Clientes activos"
          value={metrics.totalCustomers}
          icon={Users}
        />
        <MetricCard
          title="Alertas activas"
          value={metrics.activeAlerts}
          icon={Bell}
          subtitle="Entregas, devoluciones y mantenimiento"
        />
      </div>

      <PermissionGuard permission="finance.view">
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            title="Ingresos del mes"
            value={formatMoney(metrics.monthlyIncome)}
            icon={DollarSign}
            subtitle="Utilidad real (depósitos reembolsables excluidos)"
          />
          <MetricCard
            title="Gastos del mes"
            value={formatMoney(metrics.monthlyExpenses)}
            icon={DollarSign}
            subtitle="Transacciones registradas este mes"
          />
        </div>
      </PermissionGuard>

      {metrics.configured && !metrics.error ? (
        <DashboardCharts
          vehiclesByStatus={metrics.vehiclesByStatus}
          requestsByStatus={metrics.requestsByStatus}
        />
      ) : null}
    </div>
  );
}
