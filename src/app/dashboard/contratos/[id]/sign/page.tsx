import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getContract,
  getDeliveryFlowForReservation,
} from "@/app/dashboard/contratos/actions";
import { ContractDetailActions } from "@/components/contracts/contract-actions";
import { ContractDeliveryNavigator } from "@/components/contracts/contract-delivery-navigator";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export default async function ContratoSignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const result = configured ? await getContract(id) : null;

  if (configured && result && !result.success) notFound();
  const contract = result?.success ? result.data : null;

  const user = configured ? await getCurrentUser() : null;
  const canSign = user ? await hasPermission(user.id, "contracts.sign") : false;

  let operatorName: string | null = null;
  let operatorHasSignature = false;
  if (user && configured) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, signature_url")
      .eq("id", user.id)
      .maybeSingle();
    if (profile) {
      const p = profile as {
        first_name: string;
        last_name: string;
        signature_url?: string | null;
      };
      operatorName = `${p.first_name} ${p.last_name}`.trim();
      operatorHasSignature = Boolean(p.signature_url?.trim());
    }
  }

  const deliveryFlow =
    configured && contract
      ? await getDeliveryFlowForReservation(contract.reservation_id, {
          currentStepId: "firma",
        })
      : null;

  return (
    <PermissionGuard permission="contracts.sign">
      <div className="space-y-6">
        <PageHeader
          title={contract ? `Firmar ${contract.code}` : "Firmar contrato"}
          breadcrumbs={[
            { label: "Contratos", href: "/dashboard/contratos" },
            {
              label: contract?.code ?? "Contrato",
              href: contract ? `/dashboard/contratos/${id}` : undefined,
            },
            { label: "Firmar" },
          ]}
        />

        {!configured ? (
          <SetupBanner />
        ) : contract ? (
          <>
            {deliveryFlow?.success && deliveryFlow.data ? (
              <ContractDeliveryNavigator
                contractId={deliveryFlow.data.contractId}
                steps={deliveryFlow.data.steps}
                currentStepId="firma"
              />
            ) : null}
            <p className="text-sm text-muted">
              Cliente: {contract.customerName} · Vehículo: {contract.vehicleLabel}
            </p>
            <ContractDetailActions
              contract={contract}
              canEdit={false}
              canSign={canSign}
              canCancel={false}
              operatorName={operatorName}
              operatorHasSignature={operatorHasSignature}
            />
            <Link
              href={`/dashboard/contratos/${id}`}
              className="inline-flex text-sm text-brand hover:underline"
            >
              Volver al detalle
            </Link>
          </>
        ) : null}
      </div>
    </PermissionGuard>
  );
}
