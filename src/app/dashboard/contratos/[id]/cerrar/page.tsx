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

  const isCancelled = context?.contract.status === "CANCELLED";

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
        ) : isCancelled ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-900">
            <p className="font-semibold">Este contrato está anulado</p>
            <p className="mt-2">
              No se puede completar el cierre ni generar el acta porque el
              contrato fue anulado (cancelado). Anular no es lo mismo que cerrar
              la renta.
            </p>
            <Link
              href={`/dashboard/contratos/${id}`}
              className="mt-3 inline-flex font-medium underline"
            >
              Volver al detalle del contrato
            </Link>
          </div>
        ) : context ? (
          <CloseContractWizard context={context} canSign={canSign} />
        ) : null}
      </div>
    </PermissionGuard>
  );
}
