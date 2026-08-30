import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getContract,
  getContractDeliveryProgress,
} from "@/app/dashboard/contratos/actions";
import { listPaymentReceipts } from "@/app/dashboard/recibos/actions";
import { ContractDetailActions } from "@/components/contracts/contract-actions";
import { ContractReceiptsSection } from "@/components/contracts/contract-receipts";
import { ContractDeliveryNavigator } from "@/components/contracts/contract-delivery-navigator";
import {
  buildDeliverySteps,
} from "@/lib/contracts/delivery-steps";
import { createClient } from "@/lib/supabase/server";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { formatAppDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/env";

export default async function ContratoDetailPage({
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
  const [canEdit, canSign, canCancel, canFinanceCreate, canFinanceView] = user
    ? await Promise.all([
        hasPermission(user.id, "contracts.edit"),
        hasPermission(user.id, "contracts.sign"),
        hasPermission(user.id, "contracts.cancel"),
        hasPermission(user.id, "finance.create"),
        hasPermission(user.id, "finance.view"),
      ])
    : [false, false, false, false, false];

  let operatorName: string | null = null;
  if (user && configured) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();
    if (profile) {
      operatorName = `${profile.first_name} ${profile.last_name}`.trim();
    }
  }

  const receiptsResult =
    configured && contract && canFinanceView
      ? await listPaymentReceipts({
          contractId: id,
          pageSize: "50",
        })
      : null;
  const receipts = receiptsResult?.success ? receiptsResult.data.items : [];

  const progressResult =
    configured && contract
      ? await getContractDeliveryProgress(id)
      : null;
  const progress = progressResult?.success ? progressResult.data : null;

  const deliverySteps =
    contract && progress
      ? buildDeliverySteps({
          contractId: contract.id,
          reservationId: contract.reservation_id,
          customerName: contract.customerName,
          vehicleLabel: contract.vehicleLabel,
          checkOutId: progress.checkOutId,
          checkOutChecklistCount: progress.checkOutChecklistCount,
          amountPaid: progress.amountPaid,
          hasClientSignature: progress.hasClientSignature,
          hasRepresentativeSignature: progress.hasRepresentativeSignature,
          hasPdf: progress.hasPdf,
        })
      : null;

  const canDeliver =
    contract &&
    contract.status !== "CANCELLED" &&
    !contract.closed_at;
  const canClose =
    contract &&
    contract.status !== "CANCELLED" &&
    !contract.closed_at;

  return (
    <PermissionGuard permission="contracts.view">
      <div className="space-y-6">
        <PageHeader
          title={contract ? `Contrato ${contract.code}` : "Contrato"}
          breadcrumbs={[
            { label: "Contratos", href: "/dashboard/contratos" },
            { label: contract?.code ?? "Detalle" },
          ]}
          actions={
            contract ? (
              <div className="flex flex-wrap gap-2">
                {canDeliver ? (
                  <a
                    href="#entrega"
                    className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark"
                  >
                    Entregar / continuar entrega
                  </a>
                ) : null}
                {canClose && canEdit ? (
                  <Link
                    href={`/dashboard/contratos/${id}/cerrar`}
                    className="inline-flex h-10 items-center rounded-lg border border-brand px-4 text-sm font-medium text-brand hover:bg-brand-light"
                  >
                    Cerrar renta
                  </Link>
                ) : null}
                <a
                  href={`/api/contracts/${id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-muted"
                >
                  Ver PDF
                </a>
                {canSign &&
                contract.status !== "COMPLETED" &&
                contract.status !== "CANCELLED" ? (
                  <Link
                    href={`/dashboard/contratos/${id}/sign`}
                    className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-muted"
                  >
                    Firmar
                  </Link>
                ) : null}
              </div>
            ) : null
          }
        />

        {!configured ? (
          <SetupBanner />
        ) : contract ? (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Resumen del contrato</CardTitle>
                  <StatusBadge status={contract.status} />
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted">Reserva:</span>{" "}
                  {contract.reservationCode}
                </p>
                <p>
                  <span className="text-muted">Cliente:</span>{" "}
                  {contract.customerName}
                </p>
                <p>
                  <span className="text-muted">Vehículo:</span>{" "}
                  {contract.vehicleLabel}
                </p>
                <p>
                  <span className="text-muted">Placa:</span> {contract.plate}
                </p>
                <p>
                  <span className="text-muted">Inicio:</span>{" "}
                  {formatAppDateTime(contract.start_at)}
                </p>
                <p>
                  <span className="text-muted">Fin:</span>{" "}
                  {formatAppDateTime(contract.end_at)}
                </p>
                <p>
                  <span className="text-muted">Tarifa:</span>{" "}
                  {formatMoney(contract.agreed_rate)}
                </p>
                <p>
                  <span className="text-muted">Total:</span>{" "}
                  {formatMoney(contract.total)}
                </p>
                <p>
                  <span className="text-muted">Depósito:</span>{" "}
                  {formatMoney(contract.deposit)}
                </p>
                <p>
                  <span className="text-muted">Seguro:</span>{" "}
                  {formatMoney(contract.insurance)}
                </p>
                {contract.amount_paid !== undefined ? (
                  <p>
                    <span className="text-muted">Abonado:</span>{" "}
                    {formatMoney(contract.amount_paid)}
                  </p>
                ) : null}
                {contract.balance_due !== undefined ? (
                  <p>
                    <span className="text-muted">Saldo:</span>{" "}
                    {formatMoney(contract.balance_due)}
                  </p>
                ) : null}
                {contract.closed_at ? (
                  <p>
                    <span className="text-muted">Cerrado:</span>{" "}
                    {formatAppDateTime(contract.closed_at)}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {deliverySteps && canDeliver ? (
              <ContractDeliveryNavigator
                contractId={contract.id}
                steps={deliverySteps}
              />
            ) : null}

            {contract.signatures.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Firmas registradas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {contract.signatures.map((signature) => (
                    <div
                      key={signature.id}
                      className="rounded-lg border border-border p-3"
                    >
                      <p className="font-medium">
                        {signature.signer_type === "CLIENT"
                          ? "Cliente"
                          : "Representante"}
                        : {signature.signed_by_name}
                      </p>
                      <p className="text-muted">
                        {formatAppDateTime(signature.signed_at)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {canFinanceView ? (
              <div id="abonos">
                <ContractReceiptsSection
                  contractId={contract.id}
                  customerId={contract.customer_id}
                  canCreate={canFinanceCreate}
                  receipts={receipts}
                  amountPaid={contract.amount_paid}
                  balanceDue={contract.balance_due}
                  total={contract.total}
                />
              </div>
            ) : null}

            <ContractDetailActions
              contract={contract}
              canEdit={canEdit}
              canSign={canSign}
              canCancel={canCancel}
              operatorName={operatorName}
            />
          </>
        ) : null}
      </div>
    </PermissionGuard>
  );
}
