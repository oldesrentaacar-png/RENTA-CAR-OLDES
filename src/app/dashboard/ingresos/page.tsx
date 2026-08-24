import Link from "next/link";
import { Plus } from "lucide-react";

import { listIncomeTransactions } from "@/app/dashboard/ingresos/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAppDate } from "@/lib/dates";
import {
  DEPOSIT_STATUS_LABELS,
  INCOME_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/env";

export default async function IngresosPage() {
  const configured = isSupabaseConfigured();
  const result = configured
    ? await listIncomeTransactions({ pageSize: "100" })
    : null;

  const data = result?.success ? result.data.items : [];
  const error = result && !result.success ? result.error : null;

  return (
    <ModuleListShell
      title="Ingresos"
      description="Registro de ingresos y cobros del negocio."
      permission="finance.view"
      configured={configured}
      error={error}
      count={data.length}
      countLabel="transacciones mostradas"
      actions={
        <Link href="/dashboard/ingresos/nuevo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo ingreso
          </Button>
        </Link>
      }
    >
      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin ingresos"
        emptyDescription="Registre ingresos por rentas, depósitos y otros conceptos."
        columns={[
          {
            key: "date",
            header: "Fecha",
            cell: (row) => formatAppDate(row.transaction_date),
          },
          {
            key: "type",
            header: "Tipo",
            cell: (row) => (
              <Badge variant="brand">{INCOME_TYPE_LABELS[row.type]}</Badge>
            ),
          },
          {
            key: "amount",
            header: "Monto",
            cell: (row) => formatMoney(row.amount),
          },
          {
            key: "deposit",
            header: "Estado dep.",
            cell: (row) =>
              row.deposit_status
                ? DEPOSIT_STATUS_LABELS[row.deposit_status]
                : "—",
            className: "hidden md:table-cell",
          },
          {
            key: "payment",
            header: "Pago",
            cell: (row) => PAYMENT_METHOD_LABELS[row.payment_method],
            className: "hidden md:table-cell",
          },
          {
            key: "reference",
            header: "Referencia",
            cell: (row) => row.reference ?? "—",
            className: "hidden lg:table-cell",
          },
        ]}
      />
    </ModuleListShell>
  );
}
