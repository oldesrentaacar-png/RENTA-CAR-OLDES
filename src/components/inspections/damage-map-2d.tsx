"use client";

import { useMemo, useState } from "react";

import { DamageMarkPanel } from "@/components/inspections/damage-mark-panel";
import { CHECKLIST_STATUS_LABELS } from "@/lib/inspections/defaults";
import {
  INSPECTION_WIREFRAME_LABELS,
  inspectionWireframePublicPath,
  resolveInspectionWireframe,
  type InspectionWireframeType,
} from "@/lib/inspections/inspection-wireframe-public";
import {
  PANEL_DAMAGE_LEGEND,
  panelDamageGlyph,
} from "@/lib/inspections/vehicle-panel-map";
import { cn } from "@/lib/utils";
import type {
  DamageSeverity,
  DamageType,
  DamageView,
  InspectionDamageMark,
} from "@/types/database";

export type DamageMarkDraft = {
  id?: string;
  view: DamageView;
  x: number;
  y: number;
  damageType: DamageType;
  severity: DamageSeverity;
  description?: string;
  markNumber: number;
};

type DamageMap2DProps = {
  marks: DamageMarkDraft[];
  onChange: (marks: DamageMarkDraft[]) => void;
  readOnly?: boolean;
  highlightOnly?: boolean;
  className?: string;
  viewPhotos?: Partial<Record<DamageView, string>>;
  vehicleCategory?: string | null;
  vehicleModel?: string | null;
  vehicleTypeSlug?: string | null;
  vehicleTypeName?: string | null;
  /** Optional override of the wireframe diagram type. */
  wireframeType?: InspectionWireframeType;
};

export function DamageMap2D({
  marks,
  onChange,
  readOnly,
  highlightOnly,
  className,
  vehicleCategory,
  vehicleModel,
  vehicleTypeSlug,
  vehicleTypeName,
  wireframeType: wireframeTypeProp,
}: DamageMap2DProps) {
  const wireframeType =
    wireframeTypeProp ??
    resolveInspectionWireframe({
      category: vehicleCategory,
      model: vehicleModel,
      typeSlug: vehicleTypeSlug,
      typeName: vehicleTypeName,
    });
  const wireframeSrc = inspectionWireframePublicPath(wireframeType);
  const wireframeLabel = INSPECTION_WIREFRAME_LABELS[wireframeType];

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const viewMarks = useMemo(() => marks, [marks]);

  function addMark(event: React.MouseEvent<HTMLDivElement>) {
    if (readOnly) return;

    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));

    const next: DamageMarkDraft = {
      view: "TOP",
      x,
      y,
      damageType: "SCRATCH",
      severity: "LOW",
      markNumber: marks.length + 1,
    };

    onChange([...marks, next]);
    setSelectedIndex(marks.length);
  }

  function updateSelected(field: Partial<DamageMarkDraft>) {
    if (selectedIndex == null) return;
    onChange(
      marks.map((mark, index) =>
        index === selectedIndex ? { ...mark, ...field } : mark,
      ),
    );
  }

  function removeSelected() {
    if (selectedIndex == null) return;
    const next = marks
      .filter((_, index) => index !== selectedIndex)
      .map((mark, index) => ({ ...mark, markNumber: index + 1 }));
    onChange(next);
    setSelectedIndex(null);
  }

  const selected = selectedIndex != null ? marks[selectedIndex] : null;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-700">
            Código de identificación
          </span>
          {PANEL_DAMAGE_LEGEND.map((item) => (
            <span
              key={item.symbol}
              className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-slate-800"
            >
              <strong>{item.symbol}</strong> = {item.meaning}
            </span>
          ))}
        </div>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
          Diagrama: {wireframeLabel}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
        <div
          className={cn(
            "relative mx-auto w-full max-w-2xl select-none",
            !readOnly && "cursor-crosshair",
          )}
          onClick={addMark}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={wireframeSrc}
            alt={`Diagrama de inspección ${wireframeLabel}`}
            className="pointer-events-none h-auto w-full"
            draggable={false}
          />
          {viewMarks.map((mark) => {
            const globalIndex = marks.indexOf(mark);
            const isSelected = globalIndex === selectedIndex;
            const glyph = panelDamageGlyph(mark.damageType);
            return (
              <button
                key={`${mark.view}-${mark.markNumber}-${mark.x}-${mark.y}`}
                type="button"
                className={cn(
                  "absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-sm font-bold text-white shadow",
                  highlightOnly
                    ? "bg-red-600"
                    : isSelected
                      ? "bg-blue-700"
                      : "bg-slate-900",
                )}
                style={{
                  left: `${mark.x * 100}%`,
                  top: `${mark.y * 100}%`,
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedIndex(globalIndex);
                }}
              >
                {glyph}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-center text-xs text-slate-600">
          {wireframeLabel} · 5 vistas · clic para marcar daño (0 golpe, + rayón,
          x faltante)
        </p>
      </div>

      {selected && !readOnly ? (
        <DamageMarkPanel
          mark={selected}
          onChange={updateSelected}
          onRemove={removeSelected}
        />
      ) : null}
    </div>
  );
}

export function damageMarksToDrafts(
  marks: InspectionDamageMark[],
): DamageMarkDraft[] {
  return marks.map((mark) => ({
    id: mark.id,
    view: mark.view,
    x: mark.x,
    y: mark.y,
    damageType: mark.damage_type,
    severity: mark.severity,
    description: mark.description ?? undefined,
    markNumber: mark.mark_number,
  }));
}

export function draftsToDamagePayload(marks: DamageMarkDraft[]) {
  return marks.map((mark) => ({
    view: mark.view,
    x: mark.x,
    y: mark.y,
    damageType: mark.damageType,
    severity: mark.severity,
    description: mark.description,
  }));
}

export { CHECKLIST_STATUS_LABELS };
