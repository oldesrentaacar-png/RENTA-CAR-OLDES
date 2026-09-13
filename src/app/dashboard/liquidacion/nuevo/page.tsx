import { listSettlementVendors } from "@/app/dashboard/liquidacion/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { SettlementForm } from "@/components/forms/settlement-form";
import { PageHeader } from "@/components/shared/page-header";
import { isSupabaseConfigured } from "@/lib/env";

export default async function NuevaLiquidacionPage() {
  const configured = isSupabaseConfigured();
  const vendorsResult = configured ? await listSettlementVendors() : null;
  const vendors = vendorsResult?.success ? vendorsResult.data : [];

  return (
    <PermissionGuard permission="finance.create">
      <div className="space-y-6">
        <PageHeader
          title="Nueva liquidación"
          description="Registre costos, facturación y ganancia de un contrato."
          breadcrumbs={[
            { label: "Liquidación", href: "/dashboard/liquidacion" },
            { label: "Nuevo" },
          ]}
        />
        {!configured ? <SetupBanner /> : <SettlementForm vendors={vendors} />}
      </div>
    </PermissionGuard>
  );
}
