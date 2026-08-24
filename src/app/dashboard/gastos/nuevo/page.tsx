import { PermissionGuard } from "@/components/auth/permission-guard";
import { ExpenseForm } from "@/components/forms/expense-form";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { listFinanceOptions } from "@/app/dashboard/ingresos/actions";
import { isSupabaseConfigured } from "@/lib/env";

export default async function NuevoGastoPage() {
  const configured = isSupabaseConfigured();
  const optionsResult = configured ? await listFinanceOptions() : null;
  const vehicles = optionsResult?.success ? optionsResult.data.vehicles : [];

  return (
    <PermissionGuard permission="finance.create">
      <div className="space-y-6">
        <PageHeader
          title="Nuevo gasto"
          description="Registre un gasto operativo o administrativo."
          breadcrumbs={[
            { label: "Gastos", href: "/dashboard/gastos" },
            { label: "Nuevo" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : (
          <ExpenseForm vehicles={vehicles} redirectTo="/dashboard/gastos" />
        )}
      </div>
    </PermissionGuard>
  );
}
