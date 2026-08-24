import { PermissionGuard } from "@/components/auth/permission-guard";
import { MaintenanceForm } from "@/components/forms/maintenance-form";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { listMaintenanceVehicles } from "@/app/dashboard/mantenimiento/actions";
import { isSupabaseConfigured } from "@/lib/env";

export default async function NuevoMantenimientoPage() {
  const configured = isSupabaseConfigured();
  const vehiclesResult = configured ? await listMaintenanceVehicles() : null;
  const vehicles = vehiclesResult?.success ? vehiclesResult.data : [];

  return (
    <PermissionGuard permission="maintenance.create">
      <div className="space-y-6">
        <PageHeader
          title="Nuevo mantenimiento"
          description="Registre o programe un servicio de mantenimiento."
          breadcrumbs={[
            { label: "Mantenimiento", href: "/dashboard/mantenimiento" },
            { label: "Nuevo" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : (
          <MaintenanceForm vehicles={vehicles} />
        )}
      </div>
    </PermissionGuard>
  );
}
