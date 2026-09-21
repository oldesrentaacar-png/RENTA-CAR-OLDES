"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { DamageMarkPanel } from "@/components/inspections/damage-mark-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export type DamagePathPoint = { x: number; y: number };

export type DamageMarkDraft = {
  id?: string;
  view: DamageView;
  x: number;
  y: number;
  damageType: DamageType;
  severity: DamageSeverity;
  description?: string;
  markNumber: number;
  /** Freehand stroke for Marcado libre (OTHER). */
  pathPoints?: DamagePathPoint[];
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

function centroid(points: DamagePathPoint[]): DamagePathPoint {
  const total = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );
  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

function pointsToSvg(points: DamagePathPoint[]): string {
  return points
    .map((point, index) => {
      const prefix = index === 0 ? "M" : "L";
      return `${prefix} ${point.x * 100} ${point.y * 100}`;
    })
    .join(" ");
}

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
  const [liveStroke, setLiveStroke] = useState<DamagePathPoint[] | null>(null);
  const drawingRef = useRef(false);
  const diagramRef = useRef<HTMLDivElement>(null);

  const isFreehand = activeTool === "OTHER";

  const normalizePoint = useCallback((clientX: number, clientY: number) => {
    const target = diagramRef.current;
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  }, []);

  function addPinMark(event: React.MouseEvent<HTMLDivElement>) {
    if (readOnly || isFreehand) return;

    const point = normalizePoint(event.clientX, event.clientY);
    if (!point) return;

    const next: DamageMarkDraft = {
      view: "TOP",
      x: point.x,
      y: point.y,
      damageType: activeTool,
      severity: activeTool === "MISSING" ? "MEDIUM" : "LOW",
      markNumber: marks.length + 1,
    };

    onChange([...marks, next]);
    setSelectedIndex(marks.length);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (readOnly || !isFreehand) return;
    event.preventDefault();
    const point = normalizePoint(event.clientX, event.clientY);
    if (!point) return;
    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setLiveStroke([point]);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drawingRef.current || !isFreehand) return;
    event.preventDefault();
    const point = normalizePoint(event.clientX, event.clientY);
    if (!point) return;
    setLiveStroke((prev) => {
      if (!prev || prev.length === 0) return [point];
      const last = prev[prev.length - 1];
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      // Skip tiny jitter to keep strokes lighter
      if (dx * dx + dy * dy < 0.00005) return prev;
      return [...prev, point];
    });
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!drawingRef.current || !isFreehand) return;
    drawingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }

    setLiveStroke((stroke) => {
      if (!stroke || stroke.length < 2) return null;
      const center = centroid(stroke);
      const next: DamageMarkDraft = {
        view: "TOP",
        x: center.x,
        y: center.y,
        damageType: "OTHER",
        severity: "LOW",
        markNumber: marks.length + 1,
        pathPoints: stroke,
      };
      onChange([...marks, next]);
      // Trazo libre: no abrir panel de tipo/severidad; basta el dibujo.
      setSelectedIndex(null);
      return null;
    });
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
  const liveColor = DAMAGE_SEVERITY_COLORS.LOW?.fill ?? "#16a34a";

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
            const selectedTool = activeTool === tool.value;
            return (
              <button
                key={tool.value}
                type="button"
                title={tool.hint}
                onClick={() => setActiveTool(tool.value as DamageType)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  selectedTool
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
            {isFreehand
              ? "Libre: dibuje el trazo. No pide tipo ni severidad."
              : "Color = severidad: Leve · Media · Grave. Clic para colocar pin."}
          </span>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
        <div
          ref={diagramRef}
          className={cn(
            "relative mx-auto w-full max-w-2xl select-none touch-none",
            !readOnly && "cursor-crosshair",
          )}
          onClick={addPinMark}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={wireframeSrc}
            alt={`Diagrama de inspección ${wireframeLabel}`}
            className="pointer-events-none h-auto w-full"
            draggable={false}
          />

          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {marks.map((mark, index) => {
              if (!mark.pathPoints || mark.pathPoints.length < 2) return null;
              const severityColor =
                DAMAGE_SEVERITY_COLORS[mark.severity] ??
                DAMAGE_SEVERITY_COLORS.LOW;
              const isSelected = index === selectedIndex;
              return (
                <path
                  key={`stroke-${mark.markNumber}-${index}`}
                  d={pointsToSvg(mark.pathPoints)}
                  fill="none"
                  stroke={
                    highlightOnly
                      ? "#dc2626"
                      : severityColor.fill
                  }
                  strokeWidth={isSelected ? 1.8 : 1.35}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {liveStroke && liveStroke.length > 1 ? (
              <path
                d={pointsToSvg(liveStroke)}
                fill="none"
                stroke={liveColor}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>

          {marks.map((mark) => {
            const globalIndex = marks.indexOf(mark);
            const isSelected = globalIndex === selectedIndex;
            const glyph = panelDamageGlyph(mark.damageType);
            const severityColor =
              DAMAGE_SEVERITY_COLORS[mark.severity] ??
              DAMAGE_SEVERITY_COLORS.LOW;
            const isStroke =
              Boolean(mark.pathPoints && mark.pathPoints.length >= 2);

            // Freehand strokes already show the line; keep a small # badge at centroid.
            if (isStroke) {
              return (
                <button
                  key={`badge-${mark.view}-${mark.markNumber}-${mark.x}-${mark.y}`}
                  type="button"
                  title={`#${mark.markNumber} Marcado libre`}
                  className={cn(
                    "absolute flex h-6 min-w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white px-1 text-[10px] font-bold text-white shadow",
                    isSelected ? "ring-2 ring-blue-400 ring-offset-1" : null,
                  )}
                  style={{
                    left: `${mark.x * 100}%`,
                    top: `${mark.y * 100}%`,
                    backgroundColor: severityColor.fill,
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedIndex(globalIndex);
                    setActiveTool(mark.damageType);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  {mark.markNumber}
                </button>
              );
            }

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
                onPointerDown={(event) => event.stopPropagation()}
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
          {wireframeLabel} · Golpe/Rayón/Faltante = clic (pin).{" "}
          <strong>Libre = dibujar a mano alzada</strong> sobre el diagrama.
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
                <li key={`${mark.markNumber}-${mark.x}-${mark.y}-${index}`}>
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
                        {mark.pathPoints && mark.pathPoints.length >= 2
                          ? `#${mark.markNumber} · Trazo libre`
                          : `#${mark.markNumber} · ${typeLabel} · ${severity}`}
                      </span>
                      {mark.description?.trim() ? (
                        <span className="mt-0.5 block text-xs text-muted">
                          {mark.description.trim()}
                        </span>
                      ) : mark.pathPoints && mark.pathPoints.length >= 2 ? (
                        <span className="mt-0.5 block text-xs text-muted">
                          Sin detalle adicional (opcional)
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
        selected.pathPoints && selected.pathPoints.length >= 2 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">
                Trazo libre #{selected.markNumber}
              </p>
              <p className="text-xs text-muted">
                No requiere tipo ni severidad. Puede añadir una nota opcional o
                eliminar el trazo.
              </p>
              <Input
                className="mt-2 max-w-md"
                label="Nota opcional"
                value={selected.description ?? ""}
                placeholder="Detalle adicional (opcional)"
                onChange={(event) =>
                  updateSelected({ description: event.target.value })
                }
              />
            </div>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                const ok = window.confirm(
                  `¿Eliminar el trazo libre #${selected.markNumber}?\n\nDeberá guardar el mapa de daños para confirmar el cambio.`,
                );
                if (!ok) return;
                removeSelected();
              }}
            >
              Eliminar trazo
            </Button>
          </div>
        ) : (
          <DamageMarkPanel
            mark={selected}
            onChange={updateSelected}
            onRemove={removeSelected}
          />
        )
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
    pathPoints: mark.path_points ?? undefined,
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
    pathPoints: mark.pathPoints,
  }));
}

export { CHECKLIST_STATUS_LABELS };
