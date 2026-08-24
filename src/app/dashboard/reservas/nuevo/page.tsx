import { getQuote } from "@/app/dashboard/cotizaciones/actions";
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

export default async function NuevaReservaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  let customers: Array<{ id: string; label: string }> = [];
  let vehicles: Array<{
    id: string;
    label: string;
    dailyRate: number;
    deposit: number;
    category?: string | null;
  }> = [];
  const defaults: {
    customerId?: string;
    vehicleId?: string;
    quoteId?: string;
    startAt?: string;
    endAt?: string;
    agreedRate?: number;
    deposit?: number;
    insurance?: number;
    cashAmount?: number;
    total?: number;
    vehicleType?: string;
  } = {};

  if (configured) {
    const supabase = await createClient();
    const [{ data: customerRows }, { data: vehicleRows }] = await Promise.all([
      supabase.from("customers").select("*").is("deleted_at", null).order("last_name"),
      supabase.from("vehicles").select("*").is("deleted_at", null).eq("is_active", true).order("brand"),
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

    const quoteId = params.quoteId ? String(params.quoteId) : undefined;
    if (quoteId) {
      const quoteResult = await getQuote(quoteId);
      if (quoteResult.success) {
        const q = quoteResult.data;
        defaults.quoteId = q.id;
        defaults.customerId = q.customer_id;
        defaults.vehicleId = q.vehicle_id ?? undefined;
        defaults.startAt = q.start_at;
        defaults.endAt = q.end_at;
        defaults.agreedRate = q.daily_rate;
        defaults.deposit = q.deposit_amount;
        defaults.insurance = q.insurance_amount;
        defaults.total = q.total;
        defaults.cashAmount = q.total;
        if (q.vehicle_id) {
          const matched = vehicles.find((v) => v.id === q.vehicle_id);
          if (matched?.category) defaults.vehicleType = matched.category;
        }
      }
    }
  }

  return (
    <PermissionGuard permission="reservations.create">
      <div className="space-y-6">
        <PageHeader
          title="Nueva reserva"
          breadcrumbs={[
            { label: "Reservas", href: "/dashboard/reservas" },
            { label: "Nueva" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : (
          <ReservationForm
            customers={customers}
            vehicles={vehicles}
            defaults={defaults}
          />
        )}
      </div>
    </PermissionGuard>
  );
}
