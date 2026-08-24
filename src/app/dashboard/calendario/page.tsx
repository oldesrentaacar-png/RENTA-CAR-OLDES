import { listReservationsForCalendar } from "@/app/dashboard/reservas/actions";
import { ReservationCalendar } from "@/app/dashboard/calendario/calendar-view";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { mapVehicleRow, type VehicleRow } from "@/lib/db/mappers";

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const result = configured ? await listReservationsForCalendar(params) : null;
  const reservations = result?.success ? result.data : [];
  const error = result && !result.success ? result.error : null;

  let vehicles: Array<{ id: string; label: string }> = [];
  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("vehicles")
      .select("*")
      .is("deleted_at", null)
      .order("brand");
    vehicles = ((data ?? []) as VehicleRow[]).map((row) => {
      const v = mapVehicleRow(row);
      return { id: v.id, label: `${v.brand} ${v.model}` };
    });
  }

  return (
    <ModuleListShell
      title="Calendario"
      description="Vista mensual, semanal y diaria de reservas."
      permission="reservations.view"
      configured={configured}
      error={error}
      count={reservations.length}
      countLabel="reservas en calendario"
    >
      <ReservationCalendar reservations={reservations} vehicles={vehicles} />
    </ModuleListShell>
  );
}
