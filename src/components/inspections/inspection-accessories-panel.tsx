"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  saveChecklistItems,
  saveDamageMarks,
} from "@/app/dashboard/inspecciones/actions";
import {
  ChecklistForm,
  type ChecklistItemDraft,
} from "@/components/inspections/checklist-form";
import {
  damageMarksToDrafts,
  draftsToDamagePayload,
  type DamageMarkDraft,
} from "@/components/inspections/damage-map-2d";
import { DamageMapView } from "@/components/inspections/damage-map-view";
import { Button } from "@/components/ui/button";
import type {
  InspectionChecklistItem,
  InspectionDamageMark,
} from "@/types/database";

type InspectionAccessoriesPanelProps = {
  inspectionId: string;
  checklistItems: InspectionChecklistItem[];
  damageMarks: InspectionDamageMark[];
  readOnly?: boolean;
  vehiclePhotoUrl?: string | null;
  viewPhotos?: Partial<
    Record<"TOP" | "FRONT" | "REAR" | "LEFT" | "RIGHT", string>
  >;
  vehicleCategory?: string | null;
  vehicleModel?: string | null;
};

/**
 * Accesorios (checklist) + mapa de daños en una sola hoja con un solo Guardar.
 */
export function InspectionAccessoriesPanel({
  inspectionId,
  checklistItems,
  damageMarks,
  readOnly,
  vehiclePhotoUrl,
  viewPhotos,
  vehicleCategory,
  vehicleModel,
}: InspectionAccessoriesPanelProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<ChecklistItemDraft[]>(() =>
    checklistItems.map((item) => ({
      itemKey: item.item_name.toLowerCase().replace(/\s+/g, "_"),
      label: item.item_name,
      status: item.status,
      notes: item.notes ?? undefined,
    })),
  );
  const [marks, setMarks] = useState<DamageMarkDraft[]>(() =>
    damageMarksToDrafts(damageMarks),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSaveAll() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const checklistResult = await saveChecklistItems(
      inspectionId,
      JSON.stringify(
        drafts.map((item) => ({
          itemKey: item.itemKey,
          label: item.label,
          status: item.status,
          notes: item.notes,
        })),
      ),
    );

    if (!checklistResult.success) {
      setSaving(false);
      setError(checklistResult.error);
      return;
    }

    const damageResult = await saveDamageMarks(
      inspectionId,
      JSON.stringify(draftsToDamagePayload(marks)),
    );

    setSaving(false);
    if (!damageResult.success) {
      setError(
        `Checklist guardado, pero el mapa de daños falló: ${damageResult.error}`,
      );
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {saved ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Checklist y mapa de daños guardados.
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Accesorios / inventario
        </h3>
        <ChecklistForm
          inspectionId={inspectionId}
          items={checklistItems}
          readOnly={readOnly}
          hideSaveButton
          onDraftsChange={setDrafts}
        />
      </div>

      <div className="space-y-2 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">Mapa de daños</h3>
        <p className="text-sm text-muted">
          Marque rayones, golpes o faltantes en el esquema. Todo se guarda junto
          con el checklist al final.
        </p>
        <DamageMapView
          marks={marks}
          onChange={setMarks}
          readOnly={readOnly}
          vehiclePhotoUrl={vehiclePhotoUrl}
          viewPhotos={viewPhotos}
          vehicleCategory={vehicleCategory}
          vehicleModel={vehicleModel}
          defaultMode="2d"
        />
      </div>

      {!readOnly ? (
        <div className="sticky bottom-3 z-10 rounded-xl border border-border bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              Guarda accesorios y mapa de daños en un solo paso.
            </p>
            <Button type="button" onClick={() => void handleSaveAll()} loading={saving}>
              Guardar checklist y mapa de daños
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
