import { notFound } from "next/navigation";

import { getReservation } from "@/app/dashboard/reservas/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { ReservationForm } from "@/components/forms/reservation-form";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  mapCustomerRow,
  mapVehicleRow,
  type CustomerRow,
  type VehicleRow,
} from "@/lib/db/mappers";

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
    dailyRate: number;
    deposit: number;
    category?: string | null;
  }> = [];

  if (configured) {
    const supabase = await createClient();
    const [{ data: customerRows }, { data: vehicleRows }] = await Promise.all([
      supabase.from("customers").select("*").is("deleted_at", null).order("last_name"),
      supabase.from("vehicles").select("*").is("deleted_at", null).order("brand"),
    ]);
    customers = ((customerRows ?? []) as CustomerRow[]).map((row) => {
      const c = mapCustomerRow(row);
      return { id: c.id, label: `${c.first_name} ${c.last_name}` };
    });
    vehicles = ((vehicleRows ?? []) as VehicleRow[]).map((row) => {
      const v = mapVehicleRow(row);
      return {
        id: v.id,
        label: `${v.brand} ${v.model} ${v.year} · $${Number(v.daily_rate).toFixed(2)}/día`,
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
        ) : reservation ? (
          <ReservationForm
            customers={customers}
            vehicles={vehicles}
            reservation={reservation}
          />
        ) : null}
      </div>
    </PermissionGuard>
  );
}
