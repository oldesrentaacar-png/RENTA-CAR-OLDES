import Link from "next/link";
import { notFound } from "next/navigation";

import { getContractPrefillFromReservation } from "@/app/dashboard/contratos/actions";
import { ContractForm } from "@/components/contracts/contract-form";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { isSupabaseConfigured } from "@/lib/env";

export default async function NuevoContratoPage({
  searchParams,
}: {
  searchParams: Promise<{ reservation_id?: string }>;
}) {
  const { reservation_id: reservationId } = await searchParams;
  const configured = isSupabaseConfigured();

  if (!reservationId) {
    return (
      <PermissionGuard permission="contracts.create">
        <div className="space-y-6">
          <PageHeader
            title="Nuevo contrato"
            breadcrumbs={[
              { label: "Contratos", href: "/dashboard/contratos" },
              { label: "Nuevo" },
            ]}
          />
          <div className="rounded-xl border border-border bg-surface p-6 text-sm">
            <p>Seleccione una reserva para generar el contrato.</p>
            <Link href="/dashboard/reservas" className="mt-3 inline-block text-brand hover:underline">
              Ir a reservas
            </Link>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  const result = configured
    ? await getContractPrefillFromReservation(reservationId)
    : null;

  if (configured && result && !result.success) notFound();

  const prefill = result?.success ? result.data : null;

  return (
    <PermissionGuard permission="contracts.create">
      <div className="space-y-6">
        <PageHeader
          title="Nuevo contrato"
          description="Revise los términos antes de crear el contrato."
          breadcrumbs={[
            { label: "Contratos", href: "/dashboard/contratos" },
            { label: "Nuevo" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : prefill ? (
          <ContractForm
            reservation={prefill.reservation}
            customer={prefill.customer}
            vehicle={prefill.vehicle}
            defaultTerms={prefill.defaultTerms}
          />
        ) : null}
      </div>
    </PermissionGuard>
  );
}
