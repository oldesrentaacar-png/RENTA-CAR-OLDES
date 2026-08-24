import Link from "next/link";
import { Plus } from "lucide-react";

import { listExpenseTransactions } from "@/app/dashboard/gastos/actions";
import { ExpenseRowActions } from "@/components/gastos/expense-row-actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { formatAppDate } from "@/lib/dates";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/env";

export default async function GastosPage() {
  const configured = isSupabaseConfigured();
  const user = configured ? await getCurrentUser() : null;
  const [canEdit, canDelete] = user
    ? await Promise.all([
        hasPermission(user.id, "finance.edit"),
        hasPermission(user.id, "finance.delete"),
      ])
    : [false, false];

  const result = configured
    ? await listExpenseTransactions({ pageSize: "100" })
    : null;

  const data = result?.success ? result.data.items : [];
  const error = result && !result.success ? result.error : null;

  return (
    <ModuleListShell
      title="Gastos"
      description="Registro de gastos operativos y administrativos."
      permission="finance.view"
      configured={configured}
      error={error}
      count={data.length}
      countLabel="transacciones mostradas"
      actions={
        <Link href="/dashboard/gastos/nuevo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo gasto
          </Button>
        </Link>
      }
    >
      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin gastos"
        emptyDescription="Registre gastos de mantenimiento, combustible y operación."
        columns={[
          {
            key: "date",
            header: "Fecha",
            cell: (row) => formatAppDate(row.expense_date),
          },
          { key: "concept", header: "Concepto", cell: (row) => row.concept },
          {
            key: "category",
            header: "Categoría",
            cell: (row) => (
              <Badge variant="warning">
                {EXPENSE_CATEGORY_LABELS[row.category]}
              </Badge>
            ),
            className: "hidden sm:table-cell",
          },
          {
            key: "amount",
            header: "Monto",
            cell: (row) => formatMoney(row.amount),
          },
          {
            key: "provider",
            header: "Proveedor",
            cell: (row) => row.provider ?? "—",
            className: "hidden lg:table-cell",
          },
          {
            key: "receipt",
            header: "Recibo",
            cell: (row) =>
              row.receipt_path ? (
                <a
                  href={row.receipt_path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand hover:underline"
                >
                  Ver
                </a>
              ) : (
                "—"
              ),
            className: "hidden md:table-cell",
          },
          {
            key: "actions",
            header: "",
            cell: (row) => (
              <ExpenseRowActions
                expenseId={row.id}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            ),
            className: "w-[88px]",
          },
        ]}
      />
    </ModuleListShell>
  );
}
