import { listAuditLogs } from "@/app/dashboard/configuracion/actions";
import { ModuleListShell } from "@/components/dashboard/module-list-shell";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { formatAppDateTime } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const result = configured ? await listAuditLogs(params) : null;
  const data = result?.success ? result.data : null;
  const error = result && !result.success ? result.error : null;

  const timelineItems = (data?.items ?? []).slice(0, 8).map((log) => ({
    id: log.id,
    title: log.action,
    description: `${log.entity_type}${log.entity_id ? ` · ${log.entity_id.slice(0, 8)}…` : ""}`,
    timestamp: formatAppDateTime(log.created_at),
    tone: "info" as const,
  }));

  return (
    <ModuleListShell
      title="Auditoría"
      description="Historial de acciones realizadas en el sistema."
      permission="audit.view"
      configured={configured}
      error={error}
      count={data?.total ?? 0}
      countLabel="eventos registrados"
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-6 lg:col-span-1">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            Actividad reciente
          </h3>
          <ActivityTimeline items={timelineItems} />
        </div>
        <div className="lg:col-span-2">
          <DataTable
            data={data?.items ?? []}
            getRowKey={(row) => row.id}
            emptyTitle="Sin eventos"
            emptyDescription="Las acciones de usuarios se registrarán aquí."
            columns={[
              {
                key: "date",
                header: "Fecha",
                cell: (row) => formatAppDateTime(row.created_at),
              },
              { key: "action", header: "Acción", cell: (row) => row.action },
              {
                key: "entity",
                header: "Entidad",
                cell: (row) => row.entity_type,
                className: "hidden sm:table-cell",
              },
              {
                key: "user",
                header: "Usuario",
                cell: (row) => row.userName ?? (row.user_id ? "Usuario" : "Sistema"),
                className: "hidden md:table-cell",
              },
            ]}
          />
          {data ? (
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              basePath="/dashboard/auditoria"
            />
          ) : null}
        </div>
      </div>
    </ModuleListShell>
  );
}
