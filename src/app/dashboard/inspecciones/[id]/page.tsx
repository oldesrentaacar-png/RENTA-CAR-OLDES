import Link from "next/link";
import { notFound } from "next/navigation";

import { getInspection } from "@/app/dashboard/inspecciones/actions";
import { getDeliveryFlowForReservation } from "@/app/dashboard/contratos/actions";
import { InspectionAccessoriesPanel } from "@/components/inspections/inspection-accessories-panel";
import { PhotoUploader } from "@/components/inspections/photo-uploader";
import { ContractDeliveryNavigator } from "@/components/contracts/contract-delivery-navigator";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FUEL_LEVEL_LABELS,
  INSPECTION_TYPE_LABELS,
} from "@/lib/inspections/defaults";
import { resolveDeliveryStepId } from "@/lib/contracts/delivery-steps";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { formatAppDateTime } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";

export default async function InspeccionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const configured = isSupabaseConfigured();
  const result = configured ? await getInspection(id) : null;

  if (configured && result && !result.success) notFound();
  const inspection = result?.success ? result.data : null;

  const user = configured ? await getCurrentUser() : null;
  const canEdit = user
    ? await hasPermission(user.id, "inspections.edit")
    : false;

  const deliveryFlow =
    configured && inspection
      ? await getDeliveryFlowForReservation(inspection.reservation_id, {
          currentStepId: resolveDeliveryStepId({
            inspectionType: inspection.type,
            checkOutChecklistCount: inspection.checklist.length,
          }),
        })
      : null;

  return (
    <PermissionGuard permission="inspections.view">
      <div className="space-y-6">
        <PageHeader
          title={inspection ? `Inspección ${inspection.code}` : "Inspección"}
          breadcrumbs={[
            { label: "Inspecciones", href: "/dashboard/inspecciones" },
            ...(deliveryFlow?.success && deliveryFlow.data
              ? [
                  {
                    label: "Contrato",
                    href: `/dashboard/contratos/${deliveryFlow.data.contractId}`,
                  },
                ]
              : []),
            { label: inspection?.code ?? "Detalle" },
          ]}
          actions={
            inspection && deliveryFlow?.success && deliveryFlow.data ? (
              <Link
                href={`/dashboard/contratos/${deliveryFlow.data.contractId}#entrega`}
                className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90"
              >
                Continuar entrega
              </Link>
            ) : inspection ? (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/contratos/nuevo?reservation_id=${inspection.reservation_id}`}
                  className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90"
                >
                  Crear contrato
                </Link>
                <Link
                  href={`/dashboard/inspecciones/${id}/comparar?reservation_id=${inspection.reservation_id}`}
                  className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-muted"
                >
                  Comparar salida/entrada
                </Link>
              </div>
            ) : null
          }
        />

        {!configured ? (
          <SetupBanner />
        ) : inspection ? (
          <>
            {deliveryFlow?.success && deliveryFlow.data ? (
              <ContractDeliveryNavigator
                contractId={deliveryFlow.data.contractId}
                steps={deliveryFlow.data.steps}
                currentStepId={deliveryFlow.data.currentStepId}
              />
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Datos generales</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted">Tipo:</span>{" "}
                  {INSPECTION_TYPE_LABELS[inspection.type] ?? inspection.type}
                </p>
                <p>
                  <span className="text-muted">Reserva:</span>{" "}
                  {inspection.reservationCode}
                </p>
                <p>
                  <span className="text-muted">Cliente:</span>{" "}
                  {inspection.customerName}
                </p>
                <p>
                  <span className="text-muted">Vehículo:</span>{" "}
                  {inspection.vehicleLabel}
                </p>
                <p>
                  <span className="text-muted">Fecha:</span>{" "}
                  {formatAppDateTime(inspection.inspection_date)}
                </p>
                <p>
                  <span className="text-muted">Kilometraje:</span>{" "}
                  {inspection.mileage?.toLocaleString("es-SV") ?? "—"}
                </p>
                <p>
                  <span className="text-muted">Combustible:</span>{" "}
                  {inspection.fuel_level
                    ? FUEL_LEVEL_LABELS[inspection.fuel_level]
                    : "—"}
                </p>
                {inspection.notes ? (
                  <p className="sm:col-span-2">
                    <span className="text-muted">Notas:</span> {inspection.notes}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card id="accesorios">
              <CardHeader>
                <CardTitle className="text-base">
                  Accesorios y mapa de daños
                </CardTitle>
              </CardHeader>
              <CardContent>
                <InspectionAccessoriesPanel
                  inspectionId={inspection.id}
                  checklistItems={inspection.checklist}
                  damageMarks={inspection.damageMarks}
                  readOnly={!canEdit}
                  vehiclePhotoUrl={inspection.vehiclePhotoUrl}
                  viewPhotos={inspection.viewPhotos}
                  vehicleCategory={inspection.vehicleCategory}
                  vehicleModel={inspection.vehicleModel}
                  vehicleTypeSlug={inspection.vehicleTypeSlug}
                  vehicleTypeName={inspection.vehicleTypeName}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fotos</CardTitle>
              </CardHeader>
              <CardContent>
                <PhotoUploader
                  inspectionId={inspection.id}
                  photos={inspection.photos}
                  readOnly={!canEdit}
                />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </PermissionGuard>
  );
}
