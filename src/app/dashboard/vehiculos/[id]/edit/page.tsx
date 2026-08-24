import { notFound } from "next/navigation";

import {
  getVehicle,
  listVehicleTypesOption,
} from "@/app/dashboard/vehiculos/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { VehicleForm } from "@/components/forms/vehicle-form";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { isSupabaseConfigured } from "@/lib/env";

export default async function EditarVehiculoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const [result, typesResult] = configured
    ? await Promise.all([getVehicle(id), listVehicleTypesOption()])
    : [null, null];

  if (configured && result && !result.success) notFound();
  const vehicle = result?.success ? result.data : undefined;
  const vehicleTypes = typesResult?.success ? typesResult.data : [];

  return (
    <PermissionGuard permission="vehicles.edit">
      <div className="space-y-6">
        <PageHeader
          title="Editar vehículo"
          breadcrumbs={[
            { label: "Vehículos", href: "/dashboard/vehiculos" },
            { label: vehicle?.plate ?? "Editar", href: `/dashboard/vehiculos/${id}` },
            { label: "Editar" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : vehicle ? (
          <VehicleForm vehicle={vehicle} vehicleTypes={vehicleTypes} />
        ) : null}
      </div>
    </PermissionGuard>
  );
}
