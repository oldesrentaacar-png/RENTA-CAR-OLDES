import { getReservationOptionsForInspection } from "@/app/dashboard/inspecciones/actions";
import { InspectionCreateForm } from "@/components/inspections/inspection-create-form";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { isSupabaseConfigured } from "@/lib/env";

export default async function NuevaInspeccionPage({
  searchParams,
}: {
  searchParams: Promise<{ reservation_id?: string; type?: string }>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const result = configured ? await getReservationOptionsForInspection() : null;
  const reservations = result?.success ? result.data : [];

  const initialType =
    params.type === "CHECK_IN" ? "CHECK_IN" : "CHECK_OUT";

  return (
    <PermissionGuard permission="inspections.create">
      <div className="space-y-6">
        <PageHeader
          title="Nueva inspección"
          description="Registre una inspección de salida o entrada."
          breadcrumbs={[
            { label: "Inspecciones", href: "/dashboard/inspecciones" },
            { label: "Nueva" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : reservations.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
            No hay reservas disponibles para inspeccionar.
          </div>
        ) : (
          <InspectionCreateForm
            reservations={reservations}
            initialReservationId={params.reservation_id}
            initialType={initialType}
          />
        )}
      </div>
    </PermissionGuard>
  );
}
