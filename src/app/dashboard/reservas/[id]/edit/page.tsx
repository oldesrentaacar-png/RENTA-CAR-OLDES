import Link from "next/link";
import { notFound } from "next/navigation";

import { getReservation } from "@/app/dashboard/reservas/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { ReservationForm } from "@/components/forms/reservation-form";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageCourtesyDiscount } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { vehicleSelectParts } from "@/lib/vehicles/label";
import {
  mapCustomerRow,
  mapVehicleRow,
  type CustomerRow,
  type VehicleRow,
} from "@/lib/db/mappers";
import { toCustomerSelectOption } from "@/lib/customers";

export default async function EditarReservaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const result = configured ? await getReservation(id) : null;

  if (configured && result && !result.success) notFound();
  const reservation = result?.success ? result.data : undefined;

  let customers: Array<{ id: string; label: string }> = [];
  let vehicles: Array<{
    id: string;
    label: string;
    primary?: string;
    secondary?: string;
    searchText?: string;
    dailyRate: number;
    deposit: number;
    category?: string | null;
  }> = [];
  let canManageCourtesy = false;

  if (configured) {
    const user = await getCurrentUser();
    if (user) {
      canManageCourtesy = await canManageCourtesyDiscount(user.id);
    }
    const supabase = await createClient();
    const [{ data: customerRows }, { data: vehicleRows }] = await Promise.all([
      supabase.from("customers").select("*").is("deleted_at", null).order("last_name"),
      supabase.from("vehicles").select("*").is("deleted_at", null).order("plate"),
    ]);
    customers = ((customerRows ?? []) as CustomerRow[]).map((row) =>
      toCustomerSelectOption(mapCustomerRow(row)),
    );
    vehicles = ((vehicleRows ?? []) as VehicleRow[]).map((row) => {
      const v = mapVehicleRow(row);
      const parts = vehicleSelectParts({
        plate: v.plate,
        brand: v.brand,
        model: v.model,
        year: v.year,
        daily_rate: v.daily_rate,
      });
      return {
        id: v.id,
        label: parts.label,
        primary: parts.primary,
        secondary: parts.secondary,
        searchText: parts.searchText,
        dailyRate: v.daily_rate,
        deposit: v.deposit ?? 0,
        category: v.category,
      };
    });
  }

  return (
    <PermissionGuard permission="reservations.edit">
      <div className="space-y-6">
        <PageHeader
          title="Editar reserva"
          breadcrumbs={[
            { label: "Reservas", href: "/dashboard/reservas" },
            { label: reservation?.code ?? "Editar", href: `/dashboard/reservas/${id}` },
            { label: "Editar" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : reservation?.linkedContract &&
          reservation.linkedContract.status !== "COMPLETED" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
            <p className="font-medium">
              Esta reserva ya migró al contrato{" "}
              {reservation.linkedContract.code}.
            </p>
            <p className="mt-2 text-amber-900/90">
              Extienda fechas, cambie vehículo o montos desde el contrato. Al
              guardar ahí, el calendario se actualiza automáticamente.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/dashboard/contratos/${reservation.linkedContract.id}`}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Ir al contrato
              </Link>
              <Link
                href={`/dashboard/reservas/${id}`}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
              >
                Volver a la reserva
              </Link>
            </div>
          </div>
        ) : reservation ? (
          <ReservationForm
            customers={customers}
            vehicles={vehicles}
            reservation={reservation}
            canManageCourtesy={canManageCourtesy}
          />
        ) : null}
      </div>
    </PermissionGuard>
  );
}
