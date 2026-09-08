"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { DamageMarkPanel } from "@/components/inspections/damage-mark-panel";
import {
  CHECKLIST_STATUS_LABELS,
  DAMAGE_MARK_TOOLS,
  DAMAGE_SEVERITY_COLORS,
  DAMAGE_SEVERITY_LABELS,
  DAMAGE_TYPE_LABELS,
} from "@/lib/inspections/defaults";
import {
  INSPECTION_WIREFRAME_LABELS,
  INSPECTION_WIREFRAME_TYPES,
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
  const autoWireframeType = useMemo(
    () =>
      resolveInspectionWireframe({
        category: vehicleCategory,
        model: vehicleModel,
        typeSlug: vehicleTypeSlug,
        typeName: vehicleTypeName,
      }),
    [vehicleCategory, vehicleModel, vehicleTypeSlug, vehicleTypeName],
  );

  const [manualWireframeType, setManualWireframeType] =
    useState<InspectionWireframeType | null>(null);

  const wireframeType =
    wireframeTypeProp ?? manualWireframeType ?? autoWireframeType;
  const wireframeSrc = inspectionWireframePublicPath(wireframeType);
  const wireframeLabel = INSPECTION_WIREFRAME_LABELS[wireframeType];

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeTool, setActiveTool] = useState<DamageType>("SCRATCH");

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
      damageType: activeTool,
      severity: activeTool === "MISSING" ? "MEDIUM" : "LOW",
      markNumber: marks.length + 1,
    };

    onChange([...marks, next]);
    setSelectedIndex(marks.length);
  }

  function updateSelected(field: Partial<DamageMarkDraft>) {
    if (selectedIndex == null) return;
    if (field.damageType) setActiveTool(field.damageType);
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
  const diagramLocked = Boolean(wireframeTypeProp);

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

        {diagramLocked ? (
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
            Diagrama: {wireframeLabel}
          </span>
        ) : (
          <label className="relative inline-flex items-center">
            <span className="sr-only">Cambiar tipo de diagrama</span>
            <select
              value={wireframeType}
              onChange={(event) =>
                setManualWireframeType(
                  event.target.value as InspectionWireframeType,
                )
              }
              className="cursor-pointer appearance-none rounded-full bg-slate-900 py-1.5 pl-3 pr-8 text-xs font-semibold text-white shadow-sm outline-none ring-offset-1 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-brand"
              title="Si el sistema eligió mal el diagrama, cámbielo aquí"
            >
              {INSPECTION_WIREFRAME_TYPES.map((type) => (
                <option
                  key={type}
                  value={type}
                  className="bg-white text-slate-900"
                >
                  Diagrama: {INSPECTION_WIREFRAME_LABELS[type]}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-white/90"
              aria-hidden
            />
          </label>
        )}
      </div>

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Herramienta
          </span>
          {DAMAGE_MARK_TOOLS.map((tool) => {
            const selected = activeTool === tool.value;
            return (
              <button
                key={tool.value}
                type="button"
                title={tool.hint}
                onClick={() => setActiveTool(tool.value as DamageType)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  selected
                    ? "border-blue-700 bg-blue-700 text-white"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
                )}
              >
                <span className="font-mono text-sm font-bold">{tool.symbol}</span>
                {tool.label}
              </button>
            );
          })}
          <span className="ml-1 text-xs text-slate-500">
            Color = severidad:{" "}
            <span className="font-medium text-green-700">Leve</span> ·{" "}
            <span className="font-medium text-orange-700">Media</span> ·{" "}
            <span className="font-medium text-red-700">Grave</span>
          </span>
        </div>
      ) : null}

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
            const severityColor =
              DAMAGE_SEVERITY_COLORS[mark.severity] ??
              DAMAGE_SEVERITY_COLORS.LOW;
            return (
              <button
                key={`${mark.view}-${mark.markNumber}-${mark.x}-${mark.y}`}
                type="button"
                title={`#${mark.markNumber} ${DAMAGE_TYPE_LABELS[mark.damageType] ?? mark.damageType} · ${DAMAGE_SEVERITY_LABELS[mark.severity] ?? mark.severity}`}
                className={cn(
                  "absolute flex h-8 min-w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-0.5 rounded-full border-2 px-1 text-[10px] font-bold text-white shadow",
                  highlightOnly ? "bg-red-600 border-white" : null,
                  isSelected ? "ring-2 ring-blue-400 ring-offset-1" : null,
                )}
                style={{
                  left: `${mark.x * 100}%`,
                  top: `${mark.y * 100}%`,
                  backgroundColor: highlightOnly
                    ? undefined
                    : severityColor.fill,
                  borderColor: isSelected ? "#1d4ed8" : "#ffffff",
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedIndex(globalIndex);
                  setActiveTool(mark.damageType);
                }}
              >
                <span className="font-mono leading-none">{glyph}</span>
                <span className="leading-none opacity-95">
                  {mark.markNumber}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-center text-xs text-slate-600">
          {wireframeLabel} · 5 vistas · elija herramienta y haga clic (0 golpe, +
          rayón, x faltante, · marcado libre). Cada pin muestra símbolo + #.
          {!diagramLocked ? (
            <>
              {" "}
              · si el diagrama no coincide, cámbielo en el botón de arriba
            </>
          ) : null}
        </p>
      </div>

      {marks.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="border-b border-border bg-surface-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
            Marcas registradas ({marks.length})
          </div>
          <ul className="divide-y divide-border">
            {marks.map((mark, index) => {
              const glyph = panelDamageGlyph(mark.damageType);
              const severity =
                DAMAGE_SEVERITY_LABELS[mark.severity] ?? mark.severity;
              const typeLabel =
                DAMAGE_TYPE_LABELS[mark.damageType] ?? mark.damageType;
              const severityColor =
                DAMAGE_SEVERITY_COLORS[mark.severity] ??
                DAMAGE_SEVERITY_COLORS.LOW;
              const isSelected = index === selectedIndex;
              return (
                <li key={`${mark.markNumber}-${mark.x}-${mark.y}`}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm hover:bg-surface-muted/60",
                      isSelected ? "bg-blue-50" : null,
                    )}
                    onClick={() => {
                      setSelectedIndex(index);
                      setActiveTool(mark.damageType);
                    }}
                  >
                    <span
                      className="mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                      style={{ backgroundColor: severityColor.fill }}
                    >
                      {glyph}
                      {mark.markNumber}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">
                        #{mark.markNumber} · {typeLabel} · {severity}
                      </span>
                      {mark.description?.trim() ? (
                        <span className="mt-0.5 block text-xs text-muted">
                          {mark.description.trim()}
                        </span>
                      ) : (
                        <span className="mt-0.5 block text-xs text-muted">
                          Sin descripción
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

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
