import Link from "next/link";
import { notFound } from "next/navigation";

import { getInspection } from "@/app/dashboard/inspecciones/actions";
import { ChecklistForm } from "@/components/inspections/checklist-form";
import { InspectionDamageEditor } from "@/components/inspections/inspection-damage-editor";
import { PhotoUploader } from "@/components/inspections/photo-uploader";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FUEL_LEVEL_LABELS,
  INSPECTION_TYPE_LABELS,
} from "@/lib/inspections/defaults";
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

  return (
    <PermissionGuard permission="inspections.view">
      <div className="space-y-6">
        <PageHeader
          title={inspection ? `Inspección ${inspection.code}` : "Inspección"}
          breadcrumbs={[
            { label: "Inspecciones", href: "/dashboard/inspecciones" },
            { label: inspection?.code ?? "Detalle" },
          ]}
          actions={
            inspection ? (
              <Link
                href={`/dashboard/inspecciones/${id}/comparar?reservation_id=${inspection.reservation_id}`}
                className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-muted"
              >
                Comparar salida/entrada
              </Link>
            ) : null
          }
        />

        {!configured ? (
          <SetupBanner />
        ) : inspection ? (
          <>
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Checklist</CardTitle>
              </CardHeader>
              <CardContent>
                <ChecklistForm
                  inspectionId={inspection.id}
                  items={inspection.checklist}
                  readOnly={!canEdit}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mapa de daños</CardTitle>
              </CardHeader>
              <CardContent>
                <InspectionDamageEditor
                  inspectionId={inspection.id}
                  initialMarks={inspection.damageMarks}
                  readOnly={!canEdit}
                  vehiclePhotoUrl={inspection.vehiclePhotoUrl}
                  viewPhotos={inspection.viewPhotos}
                  vehicleCategory={inspection.vehicleCategory}
                  vehicleModel={inspection.vehicleModel}
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
