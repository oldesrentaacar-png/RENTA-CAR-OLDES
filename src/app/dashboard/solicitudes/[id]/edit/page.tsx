import { notFound } from "next/navigation";

import {
  getWebRequest,
  listVehicleCategoriesForRequests,
} from "@/app/dashboard/solicitudes/actions";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { WebRequestEditForm } from "@/components/forms/web-request-edit-form";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { isSupabaseConfigured } from "@/lib/env";

export default async function EditarSolicitudPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const [requestResult, categoriesResult] = configured
    ? await Promise.all([
        getWebRequest(id),
        listVehicleCategoriesForRequests(),
      ])
    : [null, null];

  if (configured && requestResult && !requestResult.success) notFound();
  const request = requestResult?.success ? requestResult.data : null;
  const categories = categoriesResult?.success
    ? categoriesResult.data.map((row) => row.name)
    : [];

  const closed = request
    ? ["CONVERTED", "REJECTED", "CANCELLED"].includes(request.status)
    : false;

  return (
    <PermissionGuard permission="requests.edit">
      <div className="space-y-6">
        <PageHeader
          title={
            request
              ? `Editar solicitud ${request.code}`
              : "Editar solicitud"
          }
          description="Corrija teléfono, fechas y tipo de vehículo antes de cotizar o convertir."
          breadcrumbs={[
            { label: "Solicitudes", href: "/dashboard/solicitudes" },
            ...(request
              ? [
                  {
                    label: request.code,
                    href: `/dashboard/solicitudes/${request.id}`,
                  },
                ]
              : []),
            { label: "Editar" },
          ]}
        />
        {!configured ? (
          <SetupBanner />
        ) : request && closed ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Esta solicitud ya está {request.status.toLowerCase()} y no se puede
            editar.
          </div>
        ) : request ? (
          <WebRequestEditForm
            request={request}
            vehicleCategories={categories}
          />
        ) : null}
      </div>
    </PermissionGuard>
  );
}
