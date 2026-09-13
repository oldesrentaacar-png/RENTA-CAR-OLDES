import Link from "next/link";
import { Pencil, Plus } from "lucide-react";

import { listVendors } from "@/app/dashboard/proveedores/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { FinanceDeleteButton } from "@/components/finance/finance-delete-button";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export default async function ProveedoresPage() {
  const configured = isSupabaseConfigured();
  const user = configured ? await getCurrentUser() : null;
  const [canEdit, canDelete] = user
    ? await Promise.all([
        hasPermission(user.id, "finance.edit"),
        hasPermission(user.id, "finance.delete"),
      ])
    : [false, false];
  const result = configured ? await listVendors() : null;
  const data = result?.success ? result.data : [];
  const error = result && !result.success ? result.error : null;

  return (
    <ModuleListShell
      title="Proveedores"
      description="Saldos pendientes con proveedores y terceros."
      permission="finance.view"
      configured={configured}
      error={error}
      count={data.length}
      countLabel="proveedores mostrados"
      actions={
        <Link href="/dashboard/proveedores/nuevo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo proveedor
          </Button>
        </Link>
      }
    >
      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin proveedores"
        emptyDescription="Cree proveedores para llevar cargos, pagos y saldos pendientes."
        columns={[
          {
            key: "name",
            header: "Proveedor",
            cell: (row) => (
              <Link
                href={`/dashboard/proveedores/${row.id}`}
                className="font-medium text-brand hover:underline"
              >
                {row.name}
              </Link>
            ),
          },
          {
            key: "charged",
            header: "Cargado",
            cell: (row) => formatMoney(row.totalCharged),
          },
          {
            key: "paid",
            header: "Pagado",
            cell: (row) => formatMoney(row.totalPaid),
          },
          {
            key: "balance",
            header: "Saldo",
            cell: (row) => formatMoney(row.balanceOwed),
          },
          {
            key: "status",
            header: "Estado",
            cell: (row) => <StatusBadge status={row.is_active ? "ACTIVE" : "INACTIVE"} />,
            className: "hidden sm:table-cell",
          },
          {
            key: "contact",
            header: "Contacto",
            cell: (row) => row.phone ?? row.email ?? "—",
            className: "hidden lg:table-cell",
          },
          {
            key: "actions",
            header: "",
            cell: (row) => (
              <div className="flex justify-end gap-1">
                {canEdit ? (
                  <Link href={`/dashboard/proveedores/${row.id}/edit`}>
                    <Button type="button" variant="outline" size="sm" title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                ) : null}
                {canDelete ? (
                  <FinanceDeleteButton
                    target="vendor"
                    id={row.id}
                    label="¿Eliminar este proveedor?"
                  />
                ) : null}
              </div>
            ),
            className: "w-[96px]",
          },
        ]}
      />
    </ModuleListShell>
  );
}
