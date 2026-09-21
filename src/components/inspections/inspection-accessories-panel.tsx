"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  saveChecklistItems,
  saveDamageMarks,
  saveInspectionGeneralNotes,
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
import { Textarea } from "@/components/ui/textarea";
import type {
  InspectionChecklistItem,
  InspectionDamageMark,
} from "@/types/database";

type InspectionAccessoriesPanelProps = {
  inspectionId: string;
  checklistItems: InspectionChecklistItem[];
  damageMarks: InspectionDamageMark[];
  generalNotes?: string | null;
  readOnly?: boolean;
  vehiclePhotoUrl?: string | null;
  viewPhotos?: Partial<
    Record<"TOP" | "FRONT" | "REAR" | "LEFT" | "RIGHT", string>
  >;
  vehicleCategory?: string | null;
  vehicleModel?: string | null;
  vehicleTypeSlug?: string | null;
  vehicleTypeName?: string | null;
};

/**
 * Accesorios (checklist) + mapa de daños + observaciones generales.
 */
export function InspectionAccessoriesPanel({
  inspectionId,
  checklistItems,
  damageMarks,
  generalNotes = "",
  readOnly,
  vehiclePhotoUrl,
  viewPhotos,
  vehicleCategory,
  vehicleModel,
  vehicleTypeSlug,
  vehicleTypeName,
}: InspectionAccessoriesPanelProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<ChecklistItemDraft[]>(() =>
    checklistItems.map((item) => ({
      itemKey: item.item_name.toLowerCase().replace(/\s+/g, "_"),
      label: item.item_name,
      status: item.status,
    })),
  );
  const [marks, setMarks] = useState<DamageMarkDraft[]>(() =>
    damageMarksToDrafts(damageMarks),
  );
  const [notes, setNotes] = useState(generalNotes ?? "");
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
          notes: "",
        })),
      ),
    );

    if (!checklistResult.success) {
      setSaving(false);
      setError(checklistResult.error);
      return;
    }

    const notesResult = await saveInspectionGeneralNotes(inspectionId, notes);
    if (!notesResult.success) {
      setSaving(false);
      setError(`Checklist guardado, pero las observaciones fallaron: ${notesResult.error}`);
      return;
    }

    const damageResult = await saveDamageMarks(
      inspectionId,
      JSON.stringify(draftsToDamagePayload(marks)),
    );

    setSaving(false);
    if (!damageResult.success) {
      setError(
        `Checklist y observaciones guardados, pero el mapa de daños falló: ${damageResult.error}`,
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
          Checklist, mapa de daños y observaciones guardados.
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
          vehicleTypeSlug={vehicleTypeSlug}
          vehicleTypeName={vehicleTypeName}
          defaultMode="2d"
        />
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-surface-muted/40 p-4">
        <h3 className="text-sm font-semibold text-foreground">
          4. Observaciones generales
        </h3>
        <p className="text-xs text-muted">
          Un solo cuadro al final, igual que en el contrato PDF. No hay notas
          por cada accesorio.
        </p>
        {readOnly ? (
          <p className="min-h-[3rem] whitespace-pre-wrap text-sm">
            {notes.trim() || "—"}
          </p>
        ) : (
          <Textarea
            label="Observaciones"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Escriba aquí cualquier observación general de la inspección…"
          />
        )}
      </div>

      {!readOnly ? (
        <div className="sticky bottom-3 z-10 rounded-xl border border-border bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              Guarda accesorios, mapa de daños y observaciones en un solo paso.
            </p>
            <Button type="button" onClick={() => void handleSaveAll()} loading={saving}>
              Guardar todo
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
