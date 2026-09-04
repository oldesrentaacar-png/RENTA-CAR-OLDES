import Link from "next/link";
import { notFound } from "next/navigation";

import { getInspectionComparison } from "@/app/dashboard/inspecciones/actions";
import { ChecklistForm } from "@/components/inspections/checklist-form";
import {
  damageMarksToDrafts,
} from "@/components/inspections/damage-map-2d";
import { DamageMapView } from "@/components/inspections/damage-map-view";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CHECKLIST_STATUS_LABELS,
  DAMAGE_SEVERITY_LABELS,
  DAMAGE_TYPE_LABELS,
} from "@/lib/inspections/defaults";
import { isSupabaseConfigured } from "@/lib/env";

export default async function InspeccionCompararPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reservation_id?: string }>;
}) {
  const { id } = await params;
  const { reservation_id: reservationIdFromQuery } = await searchParams;
  const configured = isSupabaseConfigured();

  let reservationId = reservationIdFromQuery;

  if (!reservationId && configured) {
    const { getInspection } = await import("@/app/dashboard/inspecciones/actions");
    const inspectionResult = await getInspection(id);
    if (inspectionResult.success) {
      reservationId = inspectionResult.data.reservation_id;
    }
  }

  if (!reservationId) notFound();

  const result = configured
    ? await getInspectionComparison(reservationId)
    : null;

  if (configured && result && !result.success) notFound();
  const comparison = result?.success ? result.data : null;

  return (
    <PermissionGuard permission="inspections.view">
      <div className="space-y-6">
        <PageHeader
          title="Acta visual: entrega vs recepción"
          description="Compare el esquema de salida (cómo se entregó) con el de entrada (cómo se recibió). Adjunte fotos en cada inspección; salen al final del PDF del contrato."
          breadcrumbs={[
            { label: "Inspecciones", href: "/dashboard/inspecciones" },
            { label: "Comparar" },
          ]}
        />

        {!configured ? (
          <SetupBanner />
        ) : comparison ? (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Cómo se entregó (salida)
                    {comparison.checkOut?.code
                      ? ` · ${comparison.checkOut.code}`
                      : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {comparison.checkOut ? (
                    <>
                      <ChecklistForm
                        inspectionId={comparison.checkOut.id}
                        items={comparison.checkOut.checklist}
                        readOnly
                      />
                      <DamageMapView
                        marks={damageMarksToDrafts(comparison.checkOut.damageMarks)}
                        onChange={() => undefined}
                        readOnly
                        vehiclePhotoUrl={comparison.checkOut.vehiclePhotoUrl}
                        viewPhotos={comparison.checkOut.viewPhotos}
                        vehicleCategory={comparison.checkOut.vehicleCategory}
                        vehicleModel={comparison.checkOut.vehicleModel}
                        vehicleTypeSlug={comparison.checkOut.vehicleTypeSlug}
                        vehicleTypeName={comparison.checkOut.vehicleTypeName}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-muted">Sin inspección de salida.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Cómo se recibió (entrada)
                    {comparison.checkIn?.code
                      ? ` · ${comparison.checkIn.code}`
                      : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {comparison.checkIn ? (
                    <>
                      <ChecklistForm
                        inspectionId={comparison.checkIn.id}
                        items={comparison.checkIn.checklist}
                        readOnly
                      />
                      <DamageMapView
                        marks={damageMarksToDrafts(comparison.newDamages)}
                        onChange={() => undefined}
                        readOnly
                        highlightOnly
                        vehiclePhotoUrl={comparison.checkIn.vehiclePhotoUrl}
                        viewPhotos={comparison.checkIn.viewPhotos}
                        vehicleCategory={comparison.checkIn.vehicleCategory}
                        vehicleModel={comparison.checkIn.vehicleModel}
                        vehicleTypeSlug={comparison.checkIn.vehicleTypeSlug}
                        vehicleTypeName={comparison.checkIn.vehicleTypeName}
                      />
                      <p className="text-xs text-muted">
                        Mapa de entrada resaltando solo daños nuevos respecto a la salida.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted">Sin inspección de entrada.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {comparison.changedChecklist.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cambios en checklist</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {comparison.changedChecklist.map((item) => (
                    <div
                      key={item.itemName}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                    >
                      <p className="font-medium">{item.itemName}</p>
                      <p>
                        {CHECKLIST_STATUS_LABELS[item.checkOutStatus] ?? item.checkOutStatus}
                        {" → "}
                        {CHECKLIST_STATUS_LABELS[item.checkInStatus] ?? item.checkInStatus}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {comparison.newDamages.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Daños nuevos en entrada</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {comparison.newDamages.map((mark) => (
                    <div key={mark.id} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                      <p className="font-medium">
                        #{mark.mark_number} · {mark.view}
                      </p>
                      <p>
                        {DAMAGE_TYPE_LABELS[mark.damage_type]} ·{" "}
                        {DAMAGE_SEVERITY_LABELS[mark.severity]}
                      </p>
                      {mark.description ? <p>{mark.description}</p> : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <Link
              href={`/dashboard/inspecciones/${id}`}
              className="inline-flex text-sm text-brand hover:underline"
            >
              Volver al detalle
            </Link>
          </>
        ) : null}
      </div>
    </PermissionGuard>
  );
}
