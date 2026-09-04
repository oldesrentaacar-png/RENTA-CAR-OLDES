import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getContractPrefillFromReservation,
  listReservationsEligibleForContract,
} from "@/app/dashboard/contratos/actions";
import { ContractForm } from "@/components/contracts/contract-form";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatAppDateTime } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export default async function NuevoContratoPage({
  searchParams,
}: {
  searchParams: Promise<{ reservation_id?: string; q?: string }>;
}) {
  const { reservation_id: reservationId, q } = await searchParams;
  const configured = isSupabaseConfigured();

  if (!reservationId) {
    const listResult = configured
      ? await listReservationsEligibleForContract({ q: q ? String(q) : undefined })
      : null;
    const reservations = listResult?.success ? listResult.data : [];
    const listError =
      listResult && !listResult.success ? listResult.error : null;

    return (
      <PermissionGuard permission="contracts.create">
        <div className="space-y-6">
          <PageHeader
            title="Nuevo contrato"
            description="Elija la reserva por nombre del cliente. No necesita adivinar el código."
            breadcrumbs={[
              { label: "Contratos", href: "/dashboard/contratos" },
              { label: "Nuevo" },
            ]}
          />
          {!configured ? (
            <SetupBanner />
          ) : (
            <div className="space-y-4">
              <form method="get" className="flex flex-wrap gap-2">
                <input
                  type="search"
                  name="q"
                  defaultValue={q ? String(q) : ""}
                  placeholder="Buscar por nombre del cliente o código…"
                  className="min-w-[16rem] flex-1 rounded-lg border border-zinc-300 px-3 py-2.5 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Buscar
                </button>
                {q ? (
                  <Link
                    href="/dashboard/contratos/nuevo"
                    className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-50"
                  >
                    Limpiar
                  </Link>
                ) : null}
              </form>

              {listError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {listError}
                </p>
              ) : null}

              {reservations.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
                  <p>
                    No hay reservas confirmadas o activas pendientes de
                    contrato
                    {q ? " con ese criterio" : ""}.
                  </p>
                  <Link
                    href="/dashboard/reservas"
                    className="mt-3 inline-block text-brand hover:underline"
                  >
                    Ver todas las reservas
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                  {reservations.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-base font-semibold text-zinc-900">
                          {item.customerName}
                        </p>
                        <p className="text-sm text-muted">
                          {item.code} · {item.vehicleLabel}
                        </p>
                        <p className="text-xs text-muted">
                          {formatAppDateTime(item.start_at)} –{" "}
                          {formatAppDateTime(item.end_at)} ·{" "}
                          {formatMoney(item.total)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <StatusBadge status={item.status} />
                        <Link
                          href={`/dashboard/contratos/nuevo?reservation_id=${item.id}`}
                          className="inline-flex min-h-11 items-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
                        >
                          Generar contrato
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
