import { PermissionGuard } from "@/components/auth/permission-guard";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { VendorForm } from "@/components/forms/vendor-form";
import { PageHeader } from "@/components/shared/page-header";
import { isSupabaseConfigured } from "@/lib/env";

export default async function NuevoProveedorPage() {
  const configured = isSupabaseConfigured();

  return (
    <PermissionGuard permission="finance.create">
      <div className="space-y-6">
        <PageHeader
          title="Nuevo proveedor"
          description="Cree un proveedor para llevar cargos, pagos y saldos."
          breadcrumbs={[
            { label: "Proveedores", href: "/dashboard/proveedores" },
            { label: "Nuevo" },
          ]}
        />
        {!configured ? <SetupBanner /> : <VendorForm />}
      </div>
    </PermissionGuard>
  );
}
