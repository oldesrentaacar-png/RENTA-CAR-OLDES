import Link from "next/link";
import { notFound } from "next/navigation";

import { getContract } from "@/app/dashboard/contratos/actions";
import { ContractDetailActions } from "@/components/contracts/contract-actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
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
            <p className="text-sm text-muted">
              Cliente: {contract.customerName} · Vehículo: {contract.vehicleLabel}
            </p>
            <ContractDetailActions
              contract={contract}
              canEdit={false}
              canSign={canSign}
              canCancel={false}
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
