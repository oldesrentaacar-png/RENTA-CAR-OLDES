import {
  listVehicleTypesOption,
} from "@/app/dashboard/vehiculos/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { VehicleForm } from "@/components/forms/vehicle-form";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { isSupabaseConfigured } from "@/lib/env";

export default async function NuevoVehiculoPage() {
  const configured = isSupabaseConfigured();
  const typesResult = configured ? await listVehicleTypesOption() : null;
  const vehicleTypes = typesResult?.success ? typesResult.data : [];

  return (
    <PermissionGuard permission="vehicles.create">
      <div className="space-y-6">
        <PageHeader
          title="Nuevo vehículo"
          description="Registre un vehículo en la flota."
          breadcrumbs={[
            { label: "Vehículos", href: "/dashboard/vehiculos" },
            { label: "Nuevo" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : (
          <VehicleForm vehicleTypes={vehicleTypes} />
        )}
      </div>
    </PermissionGuard>
  );
}
