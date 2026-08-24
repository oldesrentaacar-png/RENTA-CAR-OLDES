import { PermissionGuard } from "@/components/auth/permission-guard";
import { CustomerForm } from "@/components/forms/customer-form";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { isSupabaseConfigured } from "@/lib/env";

export default function NuevoClientePage() {
  const configured = isSupabaseConfigured();

  return (
    <PermissionGuard permission="customers.create">
      <div className="space-y-6">
        <PageHeader
          title="Nuevo cliente"
          description="Registre un nuevo cliente en el sistema."
          breadcrumbs={[
            { label: "Clientes", href: "/dashboard/clientes" },
            { label: "Nuevo" },
          ]}
        />
        {!configured ? <SetupBanner /> : <CustomerForm redirectTo="/dashboard/clientes" />}
      </div>
    </PermissionGuard>
  );
}
