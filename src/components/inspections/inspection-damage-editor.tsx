"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { saveDamageMarks } from "@/app/dashboard/inspecciones/actions";
import {
  damageMarksToDrafts,
  draftsToDamagePayload,
  type DamageMarkDraft,
} from "@/components/inspections/damage-map-2d";
import { DamageMapView } from "@/components/inspections/damage-map-view";
import { Button } from "@/components/ui/button";
import type { InspectionDamageMark } from "@/types/database";

type InspectionDamageEditorProps = {
  inspectionId: string;
  initialMarks: InspectionDamageMark[];
  readOnly?: boolean;
  highlightOnly?: boolean;
  vehiclePhotoUrl?: string | null;
  viewPhotos?: Partial<
    Record<"TOP" | "FRONT" | "REAR" | "LEFT" | "RIGHT", string>
  >;
  vehicleCategory?: string | null;
  vehicleModel?: string | null;
  vehicleTypeSlug?: string | null;
  vehicleTypeName?: string | null;
};

export function InspectionDamageEditor({
  inspectionId,
  initialMarks,
  readOnly,
  highlightOnly,
  vehiclePhotoUrl,
  viewPhotos,
  vehicleCategory,
  vehicleModel,
  vehicleTypeSlug,
  vehicleTypeName,
}: InspectionDamageEditorProps) {
  const router = useRouter();
  const [marks, setMarks] = useState<DamageMarkDraft[]>(() =>
    damageMarksToDrafts(initialMarks),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await saveDamageMarks(
      inspectionId,
      JSON.stringify(draftsToDamagePayload(marks)),
    );
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <DamageMapView
        marks={marks}
        onChange={setMarks}
        readOnly={readOnly}
        highlightOnly={highlightOnly}
        vehiclePhotoUrl={vehiclePhotoUrl}
        viewPhotos={viewPhotos}
        vehicleCategory={vehicleCategory}
        vehicleModel={vehicleModel}
        vehicleTypeSlug={vehicleTypeSlug}
        vehicleTypeName={vehicleTypeName}
        defaultMode="2d"
      />
      {!readOnly ? (
        <Button type="button" onClick={handleSave} loading={saving}>
          Guardar mapa de daños
        </Button>
      ) : null}
    </div>
  );
}
