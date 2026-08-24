import type { DamageView } from "@/types/database";

/** Colores del diagrama técnico CAD (estilo hoja de inspección). */
export const PICKUP_CAD_COLORS = {
  body: "#f8fafc",
  bodyStroke: "#1e3a5f",
  glass: "#93c5fd",
  glassStroke: "#1d4ed8",
  accent: "#dc2626",
  accentSoft: "#fee2e2",
  wheel: "#0f172a",
  wheelRim: "#64748b",
  shadow: "#e2e8f0",
  bed: "#e2e8f0",
} as const;

export const PICKUP_VIEWBOX = "0 0 300 300";

/**
 * Geometría CAD ortográfica de pickup doble cabina (estilo Hilux).
 * Coordenadas en viewBox 300×300 para mapa 2D e inspección.
 */
export function getPickupCadElements(view: DamageView): Array<
  | { type: "rect"; x: number; y: number; w: number; h: number; rx?: number; fill: string; stroke: string; sw?: number }
  | { type: "circle"; cx: number; cy: number; r: number; fill: string; stroke?: string; sw?: number }
  | { type: "path"; d: string; fill: string; stroke: string; sw?: number }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; sw?: number }
> {
  const C = PICKUP_CAD_COLORS;

  if (view === "TOP") {
    return [
      { type: "rect", x: 78, y: 28, w: 144, h: 244, rx: 18, fill: C.body, stroke: C.bodyStroke, sw: 2.2 },
      // cabin roof
      { type: "rect", x: 92, y: 48, w: 116, h: 88, rx: 10, fill: C.glass, stroke: C.glassStroke, sw: 1.4 },
      // bed
      { type: "rect", x: 96, y: 148, w: 108, h: 100, rx: 6, fill: C.bed, stroke: C.bodyStroke, sw: 1.4 },
      { type: "line", x1: 96, y1: 198, x2: 204, y2: 198, stroke: C.bodyStroke, sw: 1 },
      // hood line
      { type: "rect", x: 100, y: 32, w: 100, h: 14, rx: 4, fill: C.accentSoft, stroke: C.accent, sw: 1 },
      // wheels
      { type: "circle", cx: 86, cy: 72, r: 14, fill: C.wheel },
      { type: "circle", cx: 214, cy: 72, r: 14, fill: C.wheel },
      { type: "circle", cx: 86, cy: 230, r: 14, fill: C.wheel },
      { type: "circle", cx: 214, cy: 230, r: 14, fill: C.wheel },
      { type: "circle", cx: 86, cy: 72, r: 6, fill: C.wheelRim },
      { type: "circle", cx: 214, cy: 72, r: 6, fill: C.wheelRim },
      { type: "circle", cx: 86, cy: 230, r: 6, fill: C.wheelRim },
      { type: "circle", cx: 214, cy: 230, r: 6, fill: C.wheelRim },
    ];
  }

  if (view === "FRONT") {
    return [
      // body
      { type: "path", d: "M78 118 C78 88 98 72 150 72 C202 72 222 88 222 118 L222 210 L78 210 Z", fill: C.body, stroke: C.bodyStroke, sw: 2.2 },
      // windshield
      { type: "path", d: "M98 118 C110 92 190 92 202 118 L190 148 L110 148 Z", fill: C.glass, stroke: C.glassStroke, sw: 1.4 },
      // grille
      { type: "rect", x: 110, y: 158, w: 80, h: 28, rx: 4, fill: C.accentSoft, stroke: C.accent, sw: 1.4 },
      { type: "line", x1: 118, y1: 168, x2: 182, y2: 168, stroke: C.accent, sw: 1 },
      { type: "line", x1: 118, y1: 176, x2: 182, y2: 176, stroke: C.accent, sw: 1 },
      // headlights
      { type: "rect", x: 86, y: 152, w: 20, h: 14, rx: 3, fill: "#fef9c3", stroke: C.bodyStroke, sw: 1 },
      { type: "rect", x: 194, y: 152, w: 20, h: 14, rx: 3, fill: "#fef9c3", stroke: C.bodyStroke, sw: 1 },
      // bumper
      { type: "rect", x: 88, y: 198, w: 124, h: 14, rx: 3, fill: C.shadow, stroke: C.bodyStroke, sw: 1.2 },
      // wheels
      { type: "circle", cx: 108, cy: 228, r: 18, fill: C.wheel },
      { type: "circle", cx: 192, cy: 228, r: 18, fill: C.wheel },
      { type: "circle", cx: 108, cy: 228, r: 7, fill: C.wheelRim },
      { type: "circle", cx: 192, cy: 228, r: 7, fill: C.wheelRim },
    ];
  }

  if (view === "REAR") {
    return [
      { type: "path", d: "M78 100 C78 78 100 68 150 68 C200 68 222 78 222 100 L222 210 L78 210 Z", fill: C.body, stroke: C.bodyStroke, sw: 2.2 },
      // rear glass / cab
      { type: "rect", x: 108, y: 86, w: 84, h: 40, rx: 6, fill: C.glass, stroke: C.glassStroke, sw: 1.4 },
      // tailgate
      { type: "rect", x: 96, y: 136, w: 108, h: 52, rx: 4, fill: C.bed, stroke: C.bodyStroke, sw: 1.4 },
      { type: "rect", x: 130, y: 152, w: 40, h: 8, rx: 2, fill: C.accentSoft, stroke: C.accent, sw: 1 },
      // lights
      { type: "rect", x: 84, y: 140, w: 16, h: 22, rx: 2, fill: C.accent, stroke: C.bodyStroke, sw: 1 },
      { type: "rect", x: 200, y: 140, w: 16, h: 22, rx: 2, fill: C.accent, stroke: C.bodyStroke, sw: 1 },
      // bumper
      { type: "rect", x: 88, y: 196, w: 124, h: 14, rx: 3, fill: C.shadow, stroke: C.bodyStroke, sw: 1.2 },
      { type: "circle", cx: 108, cy: 228, r: 18, fill: C.wheel },
      { type: "circle", cx: 192, cy: 228, r: 18, fill: C.wheel },
      { type: "circle", cx: 108, cy: 228, r: 7, fill: C.wheelRim },
      { type: "circle", cx: 192, cy: 228, r: 7, fill: C.wheelRim },
    ];
  }

  // LEFT / RIGHT profile — double cab + bed
  const flip = view === "RIGHT";

  return [
    // shadow ground
    { type: "rect", x: 40, y: 248, w: 220, h: 8, rx: 4, fill: C.shadow, stroke: "none", sw: 0 },
    // chassis / rocker
    { type: "rect", x: 55, y: 198, w: 190, h: 18, rx: 3, fill: C.shadow, stroke: C.bodyStroke, sw: 1.2 },
    // cabin body
    {
      type: "path",
      d: flip
        ? "M210 198 L210 128 C210 112 198 100 180 96 L130 90 C112 88 100 100 98 118 L95 198 Z"
        : "M90 198 L90 128 C90 112 102 100 120 96 L170 90 C188 88 200 100 202 118 L205 198 Z",
      fill: C.body,
      stroke: C.bodyStroke,
      sw: 2.2,
    },
    // windshield
    {
      type: "path",
      d: flip
        ? "M198 128 L175 102 L145 100 L148 128 Z"
        : "M102 128 L125 102 L155 100 L152 128 Z",
      fill: C.glass,
      stroke: C.glassStroke,
      sw: 1.3,
    },
    // side window
    {
      type: "rect",
      x: flip ? 118 : 148,
      y: 108,
      w: 48,
      h: 28,
      rx: 4,
      fill: C.glass,
      stroke: C.glassStroke,
      sw: 1.2,
    },
    // bed
    {
      type: "rect",
      x: flip ? 55 : 178,
      y: 128,
      w: 88,
      h: 70,
      rx: 4,
      fill: C.bed,
      stroke: C.bodyStroke,
      sw: 1.6,
    },
    // bed rail accent
    {
      type: "rect",
      x: flip ? 55 : 178,
      y: 128,
      w: 88,
      h: 8,
      rx: 2,
      fill: C.accentSoft,
      stroke: C.accent,
      sw: 1,
    },
    // front bumper tip
    {
      type: "rect",
      x: flip ? 208 : 72,
      y: 188,
      w: 20,
      h: 12,
      rx: 2,
      fill: C.shadow,
      stroke: C.bodyStroke,
      sw: 1,
    },
    // wheels
    { type: "circle", cx: flip ? 188 : 112, cy: 220, r: 22, fill: C.wheel },
    { type: "circle", cx: flip ? 100 : 200, cy: 220, r: 22, fill: C.wheel },
    { type: "circle", cx: flip ? 188 : 112, cy: 220, r: 9, fill: C.wheelRim },
    { type: "circle", cx: flip ? 100 : 200, cy: 220, r: 9, fill: C.wheelRim },
    // door seam
    {
      type: "line",
      x1: flip ? 148 : 152,
      y1: 128,
      x2: flip ? 148 : 152,
      y2: 198,
      stroke: C.bodyStroke,
      sw: 1,
    },
  ];
}

export const DAMAGE_VIEW_LABELS: Record<DamageView, string> = {
  TOP: "Vista superior",
  FRONT: "Vista frontal",
  REAR: "Vista trasera",
  LEFT: "Lateral izquierda",
  RIGHT: "Lateral derecha",
};
