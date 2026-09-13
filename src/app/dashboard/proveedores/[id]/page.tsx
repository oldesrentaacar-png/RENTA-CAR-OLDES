import Link from "next/link";
import { Pencil } from "lucide-react";
import { notFound } from "next/navigation";

import { getVendor } from "@/app/dashboard/proveedores/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { FinanceDeleteButton } from "@/components/finance/finance-delete-button";
import { VendorLedgerEntryForm } from "@/components/forms/vendor-ledger-entry-form";
import { DataTable } from "@/components/shared/data-table";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { formatAppDate } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { VENDOR_LEDGER_KIND_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";

export default async function ProveedorDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
            vendor && canEdit ? (
              <Link href={`/dashboard/proveedores/${vendor.id}/edit`}>
                <Button variant="secondary">
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              </Link>
            ) : null
          }
        />

        {!configured ? <SetupBanner /> : null}

        {vendor ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard title="Total cargado" value={formatMoney(vendor.totalCharged)} />
              <MetricCard title="Total pagado" value={formatMoney(vendor.totalPaid)} />
              <MetricCard title="Saldo pendiente" value={formatMoney(vendor.balanceOwed)} />
            </div>

            {canCreate ? <VendorLedgerEntryForm vendorId={vendor.id} /> : null}

            <DataTable
              data={vendor.ledger}
              getRowKey={(row) => row.id}
              emptyTitle="Sin movimientos"
              emptyDescription="Agregue cargos o pagos para construir el saldo del proveedor."
              columns={[
                {
                  key: "date",
                  header: "Fecha",
                  cell: (row) => formatAppDate(row.entry_date),
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
                  className: "w-[72px]",
                },
              ]}
            />
          </>
        ) : null}
      </div>
    </PermissionGuard>
  );
}
