import Link from "next/link";

import { listAlerts } from "@/app/dashboard/alertas/actions";
import { AlertActions } from "@/app/dashboard/alertas/alert-actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { ALERT_TYPE_LABELS } from "@/lib/labels";
import { formatAppDateTime } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import type { Alert } from "@/types/database";

function severityVariant(severity: string): "info" | "warning" | "danger" | "default" {
  switch (severity) {
    case "warning":
      return "warning";
    case "danger":
      return "danger";
    case "info":
      return "info";
    default:
      return "default";
  }
}

function alertLink(alert: Alert): string | null {
  if (alert.entity_type === "reservation" && alert.entity_id) {
    return `/dashboard/reservas/${alert.entity_id}`;
  }
  if (alert.entity_type === "maintenance" && alert.entity_id) {
    return `/dashboard/mantenimiento/${alert.entity_id}`;
  }
  return null;
}

export default async function AlertasPage() {
  const configured = isSupabaseConfigured();
  const result = configured ? await listAlerts(false) : null;
  const data = result?.success ? result.data : [];
  const error = result && !result.success ? result.error : null;

  return (
    <ModuleListShell
      title="Alertas"
      description="Entregas, devoluciones y mantenimientos próximos."
      permission="dashboard.view"
      configured={configured}
      error={error}
      count={data.length}
      countLabel="alertas activas"
      actions={<AlertActions />}
    >
      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin alertas"
        emptyDescription="No hay alertas activas en este momento."
        columns={[
          {
            key: "type",
            header: "Tipo",
            cell: (row) => (
              <Badge variant="info">
                {ALERT_TYPE_LABELS[row.alert_type] ?? row.alert_type}
              </Badge>
            ),
          },
          {
            key: "title",
            header: "Título",
            cell: (row) => {
              const href = alertLink(row);
              return href ? (
                <Link href={href} className="text-brand hover:underline">
                  {row.title}
                </Link>
              ) : (
                row.title
              );
            },
          },
          {
            key: "due",
            header: "Vence",
            cell: (row) =>
              row.due_at ? formatAppDateTime(row.due_at) : "—",
            className: "hidden md:table-cell",
          },
          {
            key: "severity",
            header: "Severidad",
            cell: (row) => (
              <Badge variant={severityVariant(row.severity)}>{row.severity}</Badge>
            ),
            className: "hidden sm:table-cell",
          },
          {
            key: "read",
            header: "Leída",
            cell: (row) => (row.is_read ? "Sí" : "No"),
          },
        ]}
      />
    </ModuleListShell>
  );
}
