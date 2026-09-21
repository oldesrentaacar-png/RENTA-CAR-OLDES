import Link from "next/link";

import { listAlerts } from "@/app/dashboard/alertas/actions";
import { AlertActions } from "@/app/dashboard/alertas/alert-actions";
import { AlertRowActions } from "@/app/dashboard/alertas/alert-row-actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { ALERT_TYPE_LABELS } from "@/lib/labels";
import { formatAppDateTime12h } from "@/lib/dates";
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
  if (alert.entity_type === "contract" && alert.entity_id) {
    return `/dashboard/contratos/${alert.entity_id}`;
  }
  if (alert.entity_type === "maintenance" && alert.entity_id) {
    return `/dashboard/mantenimiento/${alert.entity_id}`;
  }
  if (alert.entity_type === "web_request" && alert.entity_id) {
    return `/dashboard/solicitudes/${alert.entity_id}`;
  }
  return null;
}

function typeBadgeVariant(
  alertType: string,
  severity: string,
): "info" | "warning" | "danger" | "default" {
  if (
    alertType === "contract_overdue" ||
    alertType === "pickup_overdue" ||
    alertType === "return_overdue" ||
    severity === "danger"
  ) {
    return "danger";
  }
  if (alertType === "webboost_notice") return "warning";
  if (severity === "warning") return "warning";
  return "info";
}

export default async function AlertasPage() {
  const configured = isSupabaseConfigured();
  const result = configured ? await listAlerts(false) : null;
  const data = result?.success ? result.data : [];
  const error = result && !result.success ? result.error : null;

  return (
    <ModuleListShell
      title="Alertas"
      description="Avisos por tu perfil (cliente y hora visibles). Quitar solo te afecta a ti. Incluye contratos abiertos vencidos."
      permission="dashboard.view"
      configured={configured}
      error={error}
      count={data.length}
      countLabel="avisos en tu perfil"
      actions={<AlertActions />}
    >
      <DataTable
        data={data}
        getRowKey={(row) => row.id}
        emptyTitle="Sin alertas"
        emptyDescription="No tienes avisos pendientes en tu perfil."
        columns={[
          {
            key: "type",
            header: "Tipo",
            cell: (row) => (
              <Badge variant={typeBadgeVariant(row.alert_type, row.severity)}>
                {ALERT_TYPE_LABELS[row.alert_type] ?? row.alert_type}
              </Badge>
            ),
          },
          {
            key: "title",
            header: "Aviso",
            cell: (row) => {
              const href = alertLink(row);
              return (
                <div className="flex max-w-md flex-col gap-0.5">
                  {href ? (
                    <Link
                      href={href}
                      className="font-medium text-brand hover:underline"
                    >
                      {row.title}
                    </Link>
                  ) : (
                    <span className="font-medium">{row.title}</span>
                  )}
                  {row.message ? (
                    <span className="text-xs text-muted">{row.message}</span>
                  ) : null}
                </div>
              );
            },
          },
          {
            key: "due",
            header: "Cuándo",
            cell: (row) =>
              row.due_at ? formatAppDateTime12h(row.due_at) : "—",
            className: "hidden md:table-cell whitespace-nowrap",
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
          {
            key: "actions",
            header: "Acciones",
            cell: (row) => (
              <AlertRowActions alertId={row.id} isRead={row.is_read} />
            ),
            className: "text-right",
          },
        ]}
      />
    </ModuleListShell>
  );
}
