import Link from "next/link";
import { notFound } from "next/navigation";

import { getReservation } from "@/app/dashboard/reservas/actions";
import { ReservationDetailActions } from "@/app/dashboard/reservas/[id]/reservation-actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatAppDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/env";

export default async function ReservaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const result = configured ? await getReservation(id) : null;

  if (configured && result && !result.success) notFound();
  const reservation = result?.success ? result.data : null;

  return (
    <PermissionGuard permission="reservations.view">
      <div className="space-y-6">
        <PageHeader
          title={reservation ? `Reserva ${reservation.code}` : "Reserva"}
          breadcrumbs={[
            { label: "Reservas", href: "/dashboard/reservas" },
            { label: reservation?.code ?? "Detalle" },
          ]}
          actions={
            reservation ? (
              <Link
                href={`/dashboard/reservas/${id}/edit`}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
              >
                Editar
              </Link>
            ) : null
          }
        />

        {!configured ? (
          <SetupBanner />
        ) : reservation ? (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Detalle de reserva</CardTitle>
                  <StatusBadge status={reservation.status} />
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <p><span className="text-muted">Inicio:</span> {formatAppDateTime(reservation.start_at)}</p>
                <p><span className="text-muted">Fin:</span> {formatAppDateTime(reservation.end_at)}</p>
                <p><span className="text-muted">Tipo:</span> {reservation.vehicle_type ?? "—"}</p>
                <p><span className="text-muted">Tarifa:</span> {formatMoney(reservation.agreed_rate)}</p>
                <p><span className="text-muted">Total:</span> {formatMoney(reservation.total)}</p>
                <p><span className="text-muted">Depósito:</span> {formatMoney(reservation.deposit)}</p>
                <p><span className="text-muted">Seguro:</span> {formatMoney(reservation.insurance)}</p>
                <p><span className="text-muted">Efectivo:</span> {formatMoney(reservation.cash_amount)}</p>
                <p><span className="text-muted">Tarjeta:</span> {formatMoney(reservation.card_amount)}</p>
                <p><span className="text-muted">Costos adicionales:</span> {formatMoney(reservation.additional_costs)}</p>
                <p><span className="text-muted">Recogida:</span> {reservation.pickup_location ?? "—"}</p>
                <p><span className="text-muted">Devolución:</span> {reservation.return_location ?? "—"}</p>
                {reservation.notes ? (
                  <p className="sm:col-span-2"><span className="text-muted">Notas:</span> {reservation.notes}</p>
                ) : null}
              </CardContent>
            </Card>
            <ReservationDetailActions reservation={reservation} />
          </>
        ) : null}
      </div>
    </PermissionGuard>
  );
}
