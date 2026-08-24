import Link from "next/link";

import { listPaymentReceipts } from "@/app/dashboard/recibos/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { formatAppDate } from "@/lib/dates";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/env";

export default async function RecibosPage() {
  const configured = isSupabaseConfigured();
  const result = configured
    ? await listPaymentReceipts({ pageSize: "100" })
    : null;

  const data = result?.success ? result.data.items : [];
  const error = result && !result.success ? result.error : null;

  return (
    <ModuleListShell
      title="Recibos y devoluciones"
      description="Comprobantes de abonos y devoluciones (PDF y WhatsApp)."
      permission="finance.view"
      configured={configured}
      error={error}
      count={data.length}
      countLabel="recibos mostrados"
    >
      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin recibos"
        emptyDescription="Registre abonos desde el detalle de un contrato."
        columns={[
          {
            key: "type",
            header: "Tipo",
            cell: (row) => (
              <Badge variant={row.receipt_kind === "REFUND" ? "warning" : "brand"}>
                {row.receipt_kind === "REFUND" ? "Devolución" : "Abono"}
              </Badge>
            ),
          },
          {
            key: "code",
            header: "Número",
            cell: (row) => (
              <span className="font-medium">{row.code}</span>
            ),
          },
          {
            key: "date",
            header: "Fecha",
            cell: (row) => formatAppDate(row.issued_at),
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
            key: "method",
            header: "Pago",
            cell: (row) => (
              <Badge variant="brand">
                {PAYMENT_METHOD_LABELS[row.payment_method]}
              </Badge>
            ),
            className: "hidden md:table-cell",
          },
          {
            key: "balance",
            header: "Saldo",
            cell: (row) => formatMoney(row.balance_remaining),
            className: "hidden lg:table-cell",
          },
          {
            key: "actions",
            header: "",
            cell: (row) => (
              <div className="flex justify-end gap-2">
                {row.contract_id ? (
                  <Link
                    href={`/dashboard/contratos/${row.contract_id}`}
                    className="text-sm text-brand hover:underline"
                  >
                    Contrato
                  </Link>
                ) : null}
                <a
                  href={`/api/receipts/${row.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand hover:underline"
                >
                  PDF
                </a>
              </div>
            ),
          },
        ]}
      />
    </ModuleListShell>
  );
}
