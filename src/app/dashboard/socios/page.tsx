import Link from "next/link";
import { Pencil, Plus } from "lucide-react";

import { listPartnerRentals } from "@/app/dashboard/socios/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { FinanceDeleteButton } from "@/components/finance/finance-delete-button";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { formatAppDate } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export default async function SociosPage() {
  const configured = isSupabaseConfigured();
  const user = configured ? await getCurrentUser() : null;
  const [canEdit, canDelete] = user
    ? await Promise.all([
        hasPermission(user.id, "finance.edit"),
        hasPermission(user.id, "finance.delete"),
      ])
    : [false, false];
  const result = configured ? await listPartnerRentals() : null;
  const data = result?.success ? result.data.items : [];
  const error = result && !result.success ? result.error : null;

  return (
    <ModuleListShell
      title="Sub-renta / Socios"
      description="Rentas trabajadas con socios, participación de terceros y utilidad OLDES."
      permission="finance.view"
      configured={configured}
      error={error}
      count={data.length}
      countLabel="rentas mostradas"
      actions={
        <Link href="/dashboard/socios/nuevo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nueva sub-renta
          </Button>
        </Link>
      }
    >
      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin sub-rentas"
        emptyDescription="Registre operaciones con socios para separar la utilidad real."
        columns={[
          { key: "customer", header: "Cliente", cell: (row) => row.customer_name },
          {
            key: "vehicle",
            header: "Vehículo",
            cell: (row) =>
              [row.vehicle_label, row.plate ? `(${row.plate})` : null]
                .filter(Boolean)
                .join(" ") || "—",
            className: "hidden md:table-cell",
          },
          {
            key: "period",
            header: "Periodo",
            cell: (row) =>
              row.start_date || row.end_date
                ? `${row.start_date ? formatAppDate(row.start_date) : "—"} - ${
                    row.end_date ? formatAppDate(row.end_date) : "—"
                  }`
                : "—",
            className: "hidden lg:table-cell",
          },
          {
            key: "client",
            header: "Cliente paga",
            cell: (row) => formatMoney(row.client_charged),
          },
          {
            key: "partner",
            header: "Socio",
            cell: (row) => formatMoney(row.partner_share),
          },
          {
            key: "own",
            header: "OLDES",
            cell: (row) => formatMoney(row.own_share),
          },
          {
            key: "status",
            header: "Estado",
            cell: (row) => <StatusBadge status={row.status} />,
          },
          {
            key: "paid",
            header: "Pagado",
            cell: (row) => (row.paid_by_client ? "Sí" : "No"),
            className: "hidden sm:table-cell",
          },
          {
            key: "actions",
            header: "",
            cell: (row) => (
              <div className="flex justify-end gap-1">
                {canEdit ? (
                  <Link href={`/dashboard/socios/${row.id}/edit`}>
                    <Button type="button" variant="outline" size="sm" title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                ) : null}
                {canDelete ? (
                  <FinanceDeleteButton
                    target="partnerRental"
                    id={row.id}
                    label="¿Eliminar esta sub-renta?"
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
