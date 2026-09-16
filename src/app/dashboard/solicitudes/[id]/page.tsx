import { notFound } from "next/navigation";
import Link from "next/link";

import { getWebRequestWithRecentHistory } from "@/app/dashboard/solicitudes/actions";
import { RequestActions } from "@/app/dashboard/solicitudes/[id]/request-actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatAppDate, formatAppDateTime } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { WEB_REQUEST_STATUS_LABELS } from "@/lib/labels";

export default async function SolicitudDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const result = configured ? await getWebRequestWithRecentHistory(id) : null;

  if (configured && result && !result.success) notFound();
  const request = result?.success ? result.data.request : null;
  const related = result?.success ? result.data.relatedInWindow : [];
  const windowHours = result?.success ? result.data.windowHours : 72;

  return (
    <PermissionGuard permission="requests.view">
      <div className="space-y-6">
        <PageHeader
          title={request ? `Solicitud ${request.code}` : "Solicitud"}
          breadcrumbs={[
            { label: "Solicitudes", href: "/dashboard/solicitudes" },
            { label: request?.code ?? "Detalle" },
          ]}
        />

        {!configured ? (
          <SetupBanner />
        ) : request ? (
          <>
            {related.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">
                  Este teléfono ya envió otra solicitud en las últimas{" "}
                  {windowHours} horas
                </p>
                <p className="mt-1 text-amber-900/90">
                  Queda como registro aunque alguna haya sido rechazada, para
                  que no se pierda el contexto si vuelve a pedir.
                </p>
                <ul className="mt-2 space-y-1">
                  {related.map((row) => (
                    <li key={row.id}>
                      <Link
                        href={`/dashboard/solicitudes/${row.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {row.code}
                      </Link>
                      {" · "}
                      {WEB_REQUEST_STATUS_LABELS[row.status] ?? row.status}
                      {" · "}
                      {formatAppDateTime(row.created_at)}
                      {row.vehicle_category
                        ? ` · ${row.vehicle_category}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {request.first_name} {request.last_name}
                  </CardTitle>
                  <StatusBadge status={request.status} />
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted">Teléfono:</span> {request.phone}
                </p>
                <p>
                  <span className="text-muted">Correo:</span>{" "}
                  {request.email ?? "—"}
                </p>
                <p>
                  <span className="text-muted">Recogida:</span>{" "}
                  {formatAppDate(request.pickup_date)} {request.pickup_time}
                </p>
                <p>
                  <span className="text-muted">Devolución:</span>{" "}
                  {formatAppDate(request.return_date)} {request.return_time}
                </p>
                <p>
                  <span className="text-muted">Categoría:</span>{" "}
                  {request.vehicle_category ?? "—"}
                </p>
                <p>
                  <span className="text-muted">Cliente vinculado:</span>{" "}
                  {request.customer_id ? (
                    <Link
                      href={`/dashboard/clientes/${request.customer_id}`}
                      className="font-medium text-brand underline-offset-2 hover:underline"
                    >
                      Ver ficha
                    </Link>
                  ) : (
                    "No (créelo en el paso 2)"
                  )}
                </p>
                {request.notes ? (
                  <p className="sm:col-span-2">
                    <span className="text-muted">Notas:</span> {request.notes}
                  </p>
                ) : null}
              </CardContent>
            </Card>
            <RequestActions request={request} />
          </>
        ) : null}
      </div>
    </PermissionGuard>
  );
}
