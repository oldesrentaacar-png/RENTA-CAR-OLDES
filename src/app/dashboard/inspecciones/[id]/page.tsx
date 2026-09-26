import { notFound } from "next/navigation";

import {
  getCheckOutDamageMarksForReservation,
  getInspection,
} from "@/app/dashboard/inspecciones/actions";
import { getDeliveryFlowForReservation } from "@/app/dashboard/contratos/actions";
import { InspectionAccessoriesPanel } from "@/components/inspections/inspection-accessories-panel";
import { PhotoUploader } from "@/components/inspections/photo-uploader";
import { ContractDeliveryNavigator } from "@/components/contracts/contract-delivery-navigator";
import { ScrollHint } from "@/components/contracts/flow-coach";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { InspectionDetailHeaderActions } from "@/components/dashboard/inspection-detail-header-actions";
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paso?: string }>;
}) {
  const { id } = await params;
  const { paso } = await searchParams;
  const configured = isSupabaseConfigured();
  const result = configured ? await getInspection(id) : null;

  if (configured && result && !result.success) notFound();
  const inspection = result?.success ? result.data : null;

  const priorDamageMarks =
    configured && inspection?.type === "CHECK_IN"
      ? await getCheckOutDamageMarksForReservation(inspection.reservation_id)
      : [];

  const user = configured ? await getCurrentUser() : null;
  const canEdit = user
    ? await hasPermission(user.id, "inspections.edit")
    : false;
  const canCreate = user
    ? await hasPermission(user.id, "inspections.create")
    : false;
  const canUploadPhotos = canEdit || canCreate;

  const deliveryFlow =
    configured && inspection
      ? await getDeliveryFlowForReservation(inspection.reservation_id, {
          currentStepId: resolveDeliveryStepId({
            inspectionType: inspection.type,
            checkOutChecklistCount: inspection.checklist.length,
            paso,
          }),
        })
      : null;

  const focusPaso =
    deliveryFlow?.success && deliveryFlow.data
      ? deliveryFlow.data.currentStepId
      : null;
  const accessoriesOnly = focusPaso === "accesorios";
  const inspectionOnly = focusPaso === "inspeccion-salida";
  const showAccessories = !focusPaso || accessoriesOnly;
  const showPhotos = !focusPaso || inspectionOnly;

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
            inspection ? (
              <InspectionDetailHeaderActions
                inspectionId={inspection.id}
                inspectionCode={inspection.code}
                reservationId={inspection.reservation_id}
                showDeliveryContinue={Boolean(
                  deliveryFlow?.success && deliveryFlow.data,
                )}
                contractId={
                  deliveryFlow?.success && deliveryFlow.data
                    ? deliveryFlow.data.contractId
                    : null
                }
              />
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
            <ScrollHint
              message={
                accessoriesOnly
                  ? "Verde es cómo salió. Marque en rojo solo el rayón nuevo."
                  : "Deslice hacia abajo para las fotos de esta inspección."
              }
            />

            {!accessoriesOnly ? (
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
                    <span className="text-muted">Observaciones generales:</span>{" "}
                    {inspection.notes}
                  </p>
                ) : null}
              </CardContent>
            </Card>
            ) : null}

            {showAccessories ? (
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
                  generalNotes={inspection.notes}
                  readOnly={!canEdit}
                  vehiclePhotoUrl={inspection.vehiclePhotoUrl}
                  viewPhotos={inspection.viewPhotos}
                  vehicleCategory={inspection.vehicleCategory}
                  vehicleModel={inspection.vehicleModel}
                  vehicleTypeSlug={inspection.vehicleTypeSlug}
                  vehicleTypeName={inspection.vehicleTypeName}
                  priorDamageMarks={priorDamageMarks}
                  newMarksInRed={inspection.type === "CHECK_IN"}
                />
              </CardContent>
            </Card>
            ) : null}

            {showPhotos ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fotos</CardTitle>
              </CardHeader>
              <CardContent>
                <PhotoUploader
                  inspectionId={inspection.id}
                  photos={inspection.photos}
                  readOnly={!canUploadPhotos}
                />
              </CardContent>
            </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </PermissionGuard>
  );
}
