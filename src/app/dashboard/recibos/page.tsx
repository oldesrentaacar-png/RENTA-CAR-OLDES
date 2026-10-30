import { listPaymentReceipts } from "@/app/dashboard/recibos/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { ListFilters } from "@/components/dashboard/list-filters";
import { ReceiptListActions } from "@/components/recibos/receipt-list-actions";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { formatAppDate } from "@/lib/dates";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/env";

export default async function RecibosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const user = configured ? await getCurrentUser() : null;
  const [canEdit, canVoid] = user
    ? await Promise.all([
        hasPermission(user.id, "finance.edit"),
        hasPermission(user.id, "finance.delete"),
      ])
    : [false, false];

  const result = configured
    ? await listPaymentReceipts({
        q: params.q,
        pageSize: "100",
        page: params.page,
      })
    : null;

  const data = result?.success ? result.data.items : [];
  const error = result && !result.success ? result.error : null;

  return (
    <ModuleListShell
      title="Recibos y devoluciones"
      description="Comprobantes de abonos y devoluciones (PDF y WhatsApp). Anule para corregir montos."
      permission={["finance.view", "finance.create"]}
      configured={configured}
      error={error}
      count={data.length}
      countLabel="recibos mostrados"
    >
      <form method="get" className="mb-4">
        <ListFilters
          q={String(params.q ?? "")}
          searchPlaceholder="Nombre, correlativo o contrato…"
        />
      </form>
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
            cell: (row) => <span className="font-medium">{row.code}</span>,
          },
          {
            key: "customer",
            header: "Cliente",
            cell: (row) => row.customerName,
          },
          {
            key: "contract",
            header: "Contrato",
            cell: (row) => row.contractCode ?? "—",
            className: "hidden md:table-cell",
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
            className: "hidden lg:table-cell",
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
            className: "hidden lg:table-cell",
          },
          {
            key: "balance",
            header: "Saldo",
            cell: (row) => formatMoney(row.balance_remaining),
            className: "hidden xl:table-cell",
          },
          {
            key: "actions",
            header: "Acciones",
            cell: (row) => (
              <ReceiptListActions
                receiptId={row.id}
                receiptCode={row.code}
                contractId={row.contract_id}
                updatedAt={row.updated_at}
                canEdit={canEdit}
                canVoid={canVoid}
              />
            ),
            className: "text-right",
          },
        ]}
      />
    </ModuleListShell>
  );
}
