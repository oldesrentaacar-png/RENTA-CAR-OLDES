import {
  listSettlementVendors,
  lookupContractById,
} from "@/app/dashboard/liquidacion/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { SettlementForm } from "@/components/forms/settlement-form";
import { PageHeader } from "@/components/shared/page-header";
import { isSupabaseConfigured } from "@/lib/env";

export default async function NuevaLiquidacionPage({
  searchParams,
}: {
  searchParams: Promise<{ contractId?: string }>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const vendorsResult = configured ? await listSettlementVendors() : null;
  const vendors = vendorsResult?.success ? vendorsResult.data : [];

  let initialContract = null;
  if (configured && params.contractId) {
    const lookup = await lookupContractById(String(params.contractId));
    if (lookup.success) initialContract = lookup.data;
  }

  return (
    <PermissionGuard permission="finance.create">
      <div className="space-y-6">
        <PageHeader
          title="Repartir costos / liquidación"
          description="Al cerrar una renta de vehículo subarrendado: indique cuánto cobró, cuánto es suyo y cuánto del proveedor."
          breadcrumbs={[
            { label: "Liquidación", href: "/dashboard/liquidacion" },
            { label: "Nuevo" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : (
          <SettlementForm
            vendors={vendors}
            initialContract={initialContract ?? undefined}
          />
        )}
      </div>
    </PermissionGuard>
  );
}
