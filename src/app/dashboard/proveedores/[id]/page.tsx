import Link from "next/link";
import { Pencil } from "lucide-react";
import { notFound } from "next/navigation";

import { getVendor } from "@/app/dashboard/proveedores/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { FinanceDeleteButton } from "@/components/finance/finance-delete-button";
import { PrintStatementButton } from "@/components/finance/print-statement-button";
import { VendorLedgerEntryForm } from "@/components/forms/vendor-ledger-entry-form";
import { DataTable } from "@/components/shared/data-table";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { formatRentalDate } from "@/lib/finance/vendor-rental";
import { BRAND } from "@/lib/brand";
import { isSupabaseConfigured } from "@/lib/env";
import { VENDOR_LEDGER_KIND_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";

function asText(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

export default async function ProveedorDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const from = asText(query.from);
  const to = asText(query.to);
  const configured = isSupabaseConfigured();
  const user = configured ? await getCurrentUser() : null;
  const [canCreate, canEdit, canDelete] = user
    ? await Promise.all([
        hasPermission(user.id, "finance.create"),
        hasPermission(user.id, "finance.edit"),
        hasPermission(user.id, "finance.delete"),
      ])
    : [false, false, false];
  const result = configured ? await getVendor(id) : null;

  if (configured && result && !result.success) notFound();

  const vendor = result?.success ? result.data : null;
  const statement = vendor
    ? vendor.ledger.filter((row) => {
        const day = row.entry_date.slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
      })
    : [];
  const listedCharged = statement
    .filter((row) => row.kind === "CHARGE")
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const listedPaid = statement
    .filter((row) => row.kind === "PAYMENT")
    .reduce((sum, row) => sum + Number(row.amount), 0);

  return (
    <PermissionGuard permission="finance.view">
      <div className="space-y-6">
        <PageHeader
          title={vendor?.name ?? "Proveedor"}
          description="Libro de cargos y pagos del proveedor."
          breadcrumbs={[
            { label: "Proveedores", href: "/dashboard/proveedores" },
            { label: vendor?.name ?? "Detalle" },
          ]}
          actions={
            vendor ? (
              <div className="flex gap-2 print:hidden">
                <PrintStatementButton />
                {canEdit ? (
                  <Link href={`/dashboard/proveedores/${vendor.id}/edit`}>
                    <Button variant="secondary">
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                  </Link>
                ) : null}
              </div>
            ) : null
          }
        />

        {!configured ? <SetupBanner /> : null}

        {vendor ? (
          <>
            <div className="hidden print:block">
              <p className="text-sm font-semibold">{BRAND.fullName}</p>
              <h1 className="text-xl font-bold">Estado de cuenta</h1>
              <p className="text-sm">{vendor.name}</p>
              <p className="text-sm">
                {from || to
                  ? `Periodo ${from || "inicio"} – ${to || "hoy"}`
                  : "Todos los movimientos"}
              </p>
            </div>

            <form method="get" className="flex flex-wrap items-end gap-3 print:hidden">
              <label className="text-sm">
                Desde
                <input
                  type="date"
                  name="from"
                  defaultValue={from}
                  className="mt-1 block rounded-lg border border-border px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Hasta
                <input
                  type="date"
                  name="to"
                  defaultValue={to}
                  className="mt-1 block rounded-lg border border-border px-3 py-2"
                />
              </label>
              <Button type="submit" variant="secondary">
                Filtrar
              </Button>
              {from || to ? (
                <Link
                  href={`/dashboard/proveedores/${vendor.id}`}
                  className="text-sm font-medium underline"
                >
                  Ver todo
                </Link>
              ) : null}
            </form>

            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard title="Cargos" value={formatMoney(listedCharged)} />
              <MetricCard title="Pagos entregados" value={formatMoney(listedPaid)} />
              <MetricCard
                title="Saldo de este listado"
                value={formatMoney(listedCharged - listedPaid)}
              />
            </div>
            <p className="text-sm text-muted">
              Cargo es lo que se le debe por una renta. Pago es el dinero que ya
              se le entregó. Saldo total del proveedor:{" "}
              {formatMoney(vendor.balanceOwed)}.
            </p>

            {canCreate ? (
              <VendorLedgerEntryForm
                vendorId={vendor.id}
                charges={vendor.ledger
                  .filter((row) => row.kind === "CHARGE" && row.settlement_id)
                  .map((row) => ({
                    settlementId: row.settlement_id as string,
                    contractId: row.contract_id,
                    concept: row.concept,
                    label: [row.concept, formatMoney(row.amount)]
                      .filter(Boolean)
                      .join(" · "),
                  }))}
              />
            ) : null}

            <DataTable
              data={statement}
              getRowKey={(row) => row.id}
              emptyTitle="Sin movimientos"
              emptyDescription="Agregue cargos o pagos para construir el saldo del proveedor."
              columns={[
                {
                  key: "date",
                  header: "Fecha",
                  cell: (row) => formatRentalDate(row.entry_date) ?? "—",
                },
                {
                  key: "contract",
                  header: "Contrato",
                  cell: (row) => row.contractCode ?? "—",
                  className: "hidden md:table-cell",
                },
                {
                  key: "vehicle",
                  header: "Vehículo",
                  cell: (row) => row.vehicleLabel ?? "—",
                },
                {
                  key: "plate",
                  header: "Placa",
                  cell: (row) => row.plate ?? "—",
                  className: "hidden sm:table-cell",
                },
                {
                  key: "days",
                  header: "Días",
                  cell: (row) => (row.rentalDays ? String(row.rentalDays) : "—"),
                  className: "hidden lg:table-cell",
                },
                {
                  key: "period",
                  header: "Periodo",
                  cell: (row) => row.periodLabel ?? "—",
                  className: "hidden lg:table-cell",
                },
                {
                  key: "kind",
                  header: "Tipo",
                  cell: (row) => (
                    <Badge variant={row.kind === "CHARGE" ? "warning" : "success"}>
                      {VENDOR_LEDGER_KIND_LABELS[row.kind]}
                    </Badge>
                  ),
                },
                {
                  key: "concept",
                  header: "Concepto",
                  cell: (row) => row.concept,
                },
                {
                  key: "amount",
                  header: "Monto",
                  cell: (row) => formatMoney(row.amount),
                },
                {
                  key: "notes",
                  header: "Notas",
                  cell: (row) => row.notes ?? "—",
                  className: "hidden lg:table-cell",
                },
                {
                  key: "actions",
                  header: "",
                  cell: (row) =>
                    canDelete ? (
                      <FinanceDeleteButton
                        target="vendorLedger"
                        id={row.id}
                        vendorId={vendor.id}
                        label="¿Eliminar este movimiento?"
                      />
                    ) : null,
                  className: "w-[72px] print:hidden",
                },
              ]}
            />
          </>
        ) : null}
      </div>
    </PermissionGuard>
  );
}
