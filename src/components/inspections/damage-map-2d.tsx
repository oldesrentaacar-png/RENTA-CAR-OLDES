"use client";

import { useMemo, useState } from "react";

import { DamageMarkPanel } from "@/components/inspections/damage-mark-panel";
import {
  VehiclePanelSilhouette,
  PANEL_VIEWBOX,
} from "@/components/inspections/vehicle-panel-silhouette";
import { CHECKLIST_STATUS_LABELS } from "@/lib/inspections/defaults";
import {
  PANEL_DAMAGE_LEGEND,
  panelDamageGlyph,
  resolveBodyStyle,
  type VehicleBodyStyle,
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
  /** Categoría / modelo para elegir sedán vs pickup. */
  vehicleCategory?: string | null;
  vehicleModel?: string | null;
  bodyStyle?: VehicleBodyStyle;
};

export function DamageMap2D({
  marks,
  onChange,
  readOnly,
  highlightOnly,
  className,
  vehicleCategory,
  vehicleModel,
  bodyStyle: bodyStyleProp,
}: DamageMap2DProps) {
  const bodyStyle =
    bodyStyleProp ?? resolveBodyStyle(vehicleCategory, vehicleModel);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const viewMarks = useMemo(
    () => marks.filter((mark) => mark.view === "TOP"),
    [marks],
  );

  function addMark(event: React.MouseEvent<SVGSVGElement>) {
    if (readOnly) return;

    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
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
  const vb = `0 0 ${PANEL_VIEWBOX.width} ${PANEL_VIEWBOX.height}`;

  return (
    <div className={cn("space-y-4", className)}>
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

      <div className="overflow-hidden rounded-xl border border-slate-300 bg-[#f7f1d8] p-3 shadow-sm">
        <svg
          viewBox={vb}
          className={cn(
            "mx-auto h-auto w-full max-w-md",
            !readOnly && "cursor-crosshair",
          )}
          onClick={addMark}
        >
          <VehiclePanelSilhouette bodyStyle={bodyStyle} />
          {viewMarks.map((mark) => {
            const globalIndex = marks.indexOf(mark);
            const isSelected = globalIndex === selectedIndex;
            const glyph = panelDamageGlyph(mark.damageType);
            return (
              <g key={`${mark.view}-${mark.markNumber}-${mark.x}-${mark.y}`}>
                <circle
                  cx={mark.x * PANEL_VIEWBOX.width}
                  cy={mark.y * PANEL_VIEWBOX.height}
                  r={isSelected ? 14 : 12}
                  fill={
                    highlightOnly
                      ? "#dc2626"
                      : isSelected
                        ? "#1d4ed8"
                        : "#0f172a"
                  }
                  stroke="#fff"
                  strokeWidth="2"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedIndex(globalIndex);
                  }}
                />
                <text
                  x={mark.x * PANEL_VIEWBOX.width}
                  y={mark.y * PANEL_VIEWBOX.height + 5}
                  textAnchor="middle"
                  fontSize="14"
                  fill="#fff"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {glyph}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="mt-2 text-center text-xs text-slate-600">
          Vista superior con paneles · clic para marcar daño (0 golpe, + rayón, x
          faltante)
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
