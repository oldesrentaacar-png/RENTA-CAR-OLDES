import { notFound } from "next/navigation";

import { getInspection } from "@/app/dashboard/inspecciones/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { InspectionEditForm } from "@/components/inspections/inspection-edit-form";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { isSupabaseConfigured } from "@/lib/env";

export default async function EditarInspeccionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const result = configured ? await getInspection(id) : null;

  if (configured && result && !result.success) notFound();
  const inspection = result?.success ? result.data : null;

  return (
    <PermissionGuard permission="inspections.edit">
      <div className="space-y-6">
        <PageHeader
          title={
            inspection
              ? `Editar inspección ${inspection.code}`
              : "Editar inspección"
          }
          description="Actualice fecha, kilometraje, combustible y notas."
          breadcrumbs={[
            { label: "Inspecciones", href: "/dashboard/inspecciones" },
            ...(inspection
              ? [
                  {
                    label: inspection.code,
                    href: `/dashboard/inspecciones/${inspection.id}`,
                  },
                ]
              : []),
            { label: "Editar" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : inspection ? (
          <InspectionEditForm
            inspectionId={inspection.id}
            code={inspection.code}
            type={inspection.type}
            inspectionDate={inspection.inspection_date}
            mileage={inspection.mileage}
            fuelLevel={inspection.fuel_level}
            handoverPersonName={inspection.handover_person_name}
            additionalDriverName={inspection.additional_driver_name}
            notes={inspection.notes}
            reservationLabel={inspection.reservationCode}
            vehicleLabel={inspection.vehicleLabel}
            customerName={inspection.customerName}
          />
        ) : null}
      </div>
    </PermissionGuard>
  );
}
