import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getContractCloseContext } from "@/app/dashboard/contratos/actions";
import { CloseContractWizard } from "@/components/contracts/close-contract-wizard";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";

export default async function CerrarContratoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const result = configured ? await getContractCloseContext(id) : null;

  if (configured && result && !result.success) notFound();
  const context = result?.success ? result.data : null;

  if (context?.contract.closed_at) {
    redirect(`/dashboard/contratos/${id}`);
  }
  if (context?.contract.status === "CANCELLED") {
    redirect(`/dashboard/contratos/${id}`);
  }

  const user = configured ? await getCurrentUser() : null;
  const canSign = user
    ? await hasPermission(user.id, "contracts.sign")
    : false;

  return (
    <PermissionGuard permission="contracts.edit">
      <div className="space-y-6">
        <PageHeader
          title={
            context
              ? `Cerrar renta · ${context.contract.code}`
              : "Cerrar renta"
          }
          description="Inspección de entrada, cargos, saldo y cierre del contrato."
          breadcrumbs={[
            { label: "Contratos", href: "/dashboard/contratos" },
            {
              label: context?.contract.code ?? "Detalle",
              href: `/dashboard/contratos/${id}`,
            },
            { label: "Cerrar" },
          ]}
          actions={
            <Link
              href={`/dashboard/contratos/${id}`}
              className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-muted"
            >
              Volver al contrato
            </Link>
          }
        />

        {!configured ? (
          <SetupBanner />
        ) : context ? (
          <CloseContractWizard context={context} canSign={canSign} />
        ) : null}
      </div>
    </PermissionGuard>
  );
}
