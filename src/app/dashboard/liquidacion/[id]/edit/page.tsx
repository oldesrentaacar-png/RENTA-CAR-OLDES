import { notFound } from "next/navigation";

import {
  getMonthlySettlement,
  listSettlementVendors,
} from "@/app/dashboard/liquidacion/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { SettlementForm } from "@/components/forms/settlement-form";
import { PageHeader } from "@/components/shared/page-header";
import { isSupabaseConfigured } from "@/lib/env";

export default async function EditarLiquidacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const [settlementResult, vendorsResult] = configured
    ? await Promise.all([getMonthlySettlement(id), listSettlementVendors()])
    : [null, null];

  if (configured && settlementResult && !settlementResult.success) notFound();

  const settlement = settlementResult?.success ? settlementResult.data : null;
  const vendors = vendorsResult?.success ? vendorsResult.data : [];

  return (
    <PermissionGuard permission="finance.edit">
      <div className="space-y-6">
        <PageHeader
          title={
            settlement
              ? `Editar liquidación: ${settlement.contract_code ?? "Manual"}`
              : "Editar liquidación"
          }
          description="Actualice costos, facturación y ganancia del contrato."
          breadcrumbs={[
            { label: "Liquidación", href: "/dashboard/liquidacion" },
            { label: "Editar" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : settlement ? (
          <SettlementForm vendors={vendors} settlement={settlement} />
        ) : null}
      </div>
    </PermissionGuard>
  );
}
