import { PermissionGuard } from "@/components/auth/permission-guard";
import { IncomeForm } from "@/components/forms/income-form";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { listFinanceOptions } from "@/app/dashboard/ingresos/actions";
import { isSupabaseConfigured } from "@/lib/env";

export default async function NuevoIngresoPage() {
  const configured = isSupabaseConfigured();
  const optionsResult = configured ? await listFinanceOptions() : null;
  const options = optionsResult?.success
    ? optionsResult.data
    : { vehicles: [], customers: [], reservations: [] };

  return (
    <PermissionGuard permission="finance.create">
      <div className="space-y-6">
        <PageHeader
          title="Nuevo ingreso"
          description="Registre un cobro, depósito u otro ingreso."
          breadcrumbs={[
            { label: "Ingresos", href: "/dashboard/ingresos" },
            { label: "Nuevo" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : (
          <IncomeForm options={options} redirectTo="/dashboard/ingresos" />
        )}
      </div>
    </PermissionGuard>
  );
}
