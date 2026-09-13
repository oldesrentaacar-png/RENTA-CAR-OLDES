import { PermissionGuard } from "@/components/auth/permission-guard";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { PartnerRentalForm } from "@/components/forms/partner-rental-form";
import { PageHeader } from "@/components/shared/page-header";
import { isSupabaseConfigured } from "@/lib/env";

export default async function NuevaSubRentaPage() {
  const configured = isSupabaseConfigured();

  return (
    <PermissionGuard permission="finance.create">
      <div className="space-y-6">
        <PageHeader
          title="Nueva sub-renta"
          description="Registre una renta trabajada con socio o vehículo sub-rentado."
          breadcrumbs={[
            { label: "Socios", href: "/dashboard/socios" },
            { label: "Nuevo" },
          ]}
        />
        {!configured ? <SetupBanner /> : <PartnerRentalForm />}
      </div>
    </PermissionGuard>
  );
}
