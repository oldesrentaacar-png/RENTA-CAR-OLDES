import type { DamageView } from "@/types/database";

/** Estilo del formulario físico de inspección OLDES (vista superior). */
export type VehicleBodyStyle = "SEDAN" | "PICKUP";

export type VehiclePanel = {
  id: string;
  label: string;
  /** Centro del texto (coords viewBox). */
  lx: number;
  ly: number;
  fontSize?: number;
};

/** Leyenda exacta del papel. */
export const PANEL_DAMAGE_LEGEND = [
  { symbol: "0", meaning: "GOLPE" },
  { symbol: "+", meaning: "RAYON" },
  { symbol: "x", meaning: "FALTANTE" },
] as const;

/** ViewBox del diagrama tipo formulario (azul sobre fondo crema). */
export const PANEL_VIEWBOX = { width: 340, height: 560 };

const STROKE = "#1e4d8c";
const FILL = "#ffffff";
const PAPER = "#f3e6c0";

export type CarPaths = {
  body: string;
  hood: string;
  roof: string;
  trunk: string;
  bumperFront: string;
  bumperRear: string;
  doorFL: string;
  doorFR: string;
  doorRL: string;
  doorRR: string;
  fenderFL: string;
  fenderFR: string;
  fenderRL: string;
  fenderRR: string;
  stepL: string;
  stepR: string;
  wheels: Array<{ cx: number; cy: number; r: number }>;
};

/**
 * Silueta vista superior tipo formulario físico OLDES.
 * Contorno orgánico con paneles etiquetados (no rectángulos apilados).
 */
export function getSedanCarPaths(): CarPaths {
  return {
    // Contorno redondeado (bumper → laterales → cola)
    body: "M120 42 C145 30 195 30 220 42 C238 55 248 78 250 110 L252 220 C254 300 250 370 238 410 C228 438 200 452 170 454 C140 452 112 438 102 410 C90 370 86 300 88 220 L90 110 C92 78 102 55 120 42 Z",
    bumperFront:
      "M128 40 C150 32 190 32 212 40 C220 44 222 52 218 58 L122 58 C118 52 120 44 128 40 Z",
    hood: "M118 62 L222 62 L230 128 L110 128 Z",
    fenderFL: "M90 95 C92 78 100 68 118 62 L110 128 L90 135 Z",
    fenderFR: "M222 62 C240 68 248 78 250 95 L250 135 L230 128 Z",
    doorFL: "M88 138 L112 132 L112 218 L88 222 Z",
    doorFR: "M228 132 L252 138 L252 222 L228 218 Z",
    stepL: "M76 150 L88 145 L88 310 L76 305 Z",
    stepR: "M252 145 L264 150 L264 305 L252 310 Z",
    roof: "M118 135 L222 135 L222 275 L118 275 Z",
    doorRL: "M88 224 L112 220 L112 305 L88 308 Z",
    doorRR: "M228 220 L252 224 L252 308 L228 305 Z",
    fenderRL: "M90 312 L112 308 L118 400 L98 408 C90 390 88 350 90 312 Z",
    fenderRR: "M228 308 L250 312 C252 350 250 390 242 408 L222 400 L228 308 Z",
    trunk: "M118 278 L222 278 L222 400 L118 400 Z",
    bumperRear:
      "M118 402 L222 402 C230 408 232 420 224 430 C200 442 140 442 116 430 C108 420 110 408 118 402 Z",
    wheels: [
      { cx: 92, cy: 118, r: 24 },
      { cx: 248, cy: 118, r: 24 },
      { cx: 92, cy: 360, r: 24 },
      { cx: 248, cy: 360, r: 24 },
    ],
  };
}

/** Pickup: misma cabina; trasera = palangana (caja abierta). */
export function getPickupCarPaths(): CarPaths {
  const sedan = getSedanCarPaths();
  return {
    ...sedan,
    roof: "M118 135 L222 135 L222 248 L118 248 Z",
    doorRL: "M88 224 L112 220 L112 252 L88 255 Z",
    doorRR: "M228 220 L252 224 L252 255 L228 252 Z",
    // Caja / palangana más ancha y rectangular
    trunk:
      "M108 252 L232 252 L242 268 L242 405 L98 405 L98 268 Z",
    fenderRL: "M88 255 L98 255 L98 405 L90 412 C86 380 86 300 88 255 Z",
    fenderRR: "M242 255 L252 255 C254 300 254 380 250 412 L242 405 L242 255 Z",
    bumperRear:
      "M108 407 L232 407 C240 412 242 424 234 434 C210 446 130 446 106 434 C98 424 100 412 108 407 Z",
    wheels: [
      { cx: 92, cy: 118, r: 24 },
      { cx: 248, cy: 118, r: 24 },
      { cx: 92, cy: 375, r: 24 },
      { cx: 248, cy: 375, r: 24 },
    ],
  };
}

export function getPanelsForBody(style: VehicleBodyStyle): VehiclePanel[] {
  if (style === "PICKUP") {
    return [
      { id: "bumper_front", label: "BUMPER DELANTERO", lx: 170, ly: 52, fontSize: 7 },
      { id: "hood", label: "TAPA MOTOR", lx: 170, ly: 98, fontSize: 9 },
      { id: "fender_fl", label: "GUARDA FANGO", lx: 100, ly: 100, fontSize: 5.5 },
      { id: "fender_fr", label: "GUARDA FANGO", lx: 240, ly: 100, fontSize: 5.5 },
      { id: "door_fl", label: "PUERTA", lx: 100, ly: 180, fontSize: 8 },
      { id: "door_fr", label: "PUERTA", lx: 240, ly: 180, fontSize: 8 },
      { id: "step_l", label: "ESTRIBO", lx: 68, ly: 230, fontSize: 5.5 },
      { id: "step_r", label: "ESTRIBO", lx: 272, ly: 230, fontSize: 5.5 },
      { id: "roof", label: "TECHO", lx: 170, ly: 195, fontSize: 11 },
      { id: "door_rl", label: "PUERTA", lx: 100, ly: 240, fontSize: 8 },
      { id: "door_rr", label: "PUERTA", lx: 240, ly: 240, fontSize: 8 },
      { id: "fender_rl", label: "GUARDA FANGO", lx: 108, ly: 330, fontSize: 5.5 },
      { id: "fender_rr", label: "GUARDA FANGO", lx: 232, ly: 330, fontSize: 5.5 },
      { id: "bed", label: "PALANGANA", lx: 170, ly: 335, fontSize: 10 },
      { id: "bumper_rear", label: "BUMPER TRASERO", lx: 170, ly: 425, fontSize: 7 },
    ];
  }
  return [
    { id: "bumper_front", label: "BUMPER DELANTERO", lx: 170, ly: 52, fontSize: 7 },
    { id: "hood", label: "TAPA MOTOR", lx: 170, ly: 98, fontSize: 9 },
    { id: "fender_fl", label: "GUARDA FANGO", lx: 100, ly: 100, fontSize: 5.5 },
    { id: "fender_fr", label: "GUARDA FANGO", lx: 240, ly: 100, fontSize: 5.5 },
    { id: "door_fl", label: "PUERTA", lx: 100, ly: 180, fontSize: 8 },
    { id: "door_fr", label: "PUERTA", lx: 240, ly: 180, fontSize: 8 },
    { id: "step_l", label: "ESTRIBO", lx: 68, ly: 230, fontSize: 5.5 },
    { id: "step_r", label: "ESTRIBO", lx: 272, ly: 230, fontSize: 5.5 },
    { id: "roof", label: "TECHO", lx: 170, ly: 205, fontSize: 11 },
    { id: "door_rl", label: "PUERTA", lx: 100, ly: 265, fontSize: 8 },
    { id: "door_rr", label: "PUERTA", lx: 240, ly: 265, fontSize: 8 },
    { id: "fender_rl", label: "GUARDA FANGO", lx: 105, ly: 355, fontSize: 5.5 },
    { id: "fender_rr", label: "GUARDA FANGO", lx: 235, ly: 355, fontSize: 5.5 },
    { id: "trunk", label: "TAPA BAUL", lx: 170, ly: 345, fontSize: 9 },
    { id: "bumper_rear", label: "BUMPER TRASERO", lx: 170, ly: 422, fontSize: 7 },
  ];
}

export function getCarPaths(style: VehicleBodyStyle) {
  return style === "PICKUP" ? getPickupCarPaths() : getSedanCarPaths();
}

export function resolveBodyStyle(
  category?: string | null,
  model?: string | null,
): VehicleBodyStyle {
  const hay = `${category ?? ""} ${model ?? ""}`.toLowerCase();
  if (
    hay.includes("pickup") ||
    hay.includes("pick-up") ||
    hay.includes("pick up") ||
    hay.includes("hilux") ||
    hay.includes("ranger") ||
    hay.includes("l200") ||
    hay.includes("np300") ||
    hay.includes("truck") ||
    hay.includes("palangana") ||
    hay.includes("frontier") ||
    hay.includes("mighty")
  ) {
    return "PICKUP";
  }
  // Camioneta / SUV / minivan usan silueta sedán (mapa superior) hasta tener paneles propios.
  return "SEDAN";
}

export function bodyStyleTitle(style: VehicleBodyStyle): string {
  return style === "PICKUP" ? "PICKUP" : "CARRO SEDAN";
}

/** Subtítulo del tipo (baúl vs palangana). */
export function bodyStyleSubtitle(style: VehicleBodyStyle): string {
  return style === "PICKUP" ? "PALANGANA" : "TAPA BAUL";
}

export function panelDamageGlyph(damageType?: string): string {
  if (damageType === "SCRATCH" || damageType === "PAINT") return "+";
  if (damageType === "MISSING" || damageType === "BROKEN" || damageType === "CRACK")
    return "x";
  return "0";
}

export function isTopInspectionView(view: DamageView): boolean {
  return view === "TOP";
}

export { STROKE, FILL, PAPER };

/**
 * SVG completo de un carro (listo para sharp o DOM).
 */
export function buildCarDiagramSvg(
  style: VehicleBodyStyle,
  options?: { width?: number; height?: number; showLegend?: boolean },
): string {
  const width = options?.width ?? PANEL_VIEWBOX.width;
  const height = options?.height ?? PANEL_VIEWBOX.height;
  const paths = getCarPaths(style);
  const panels = getPanelsForBody(style);
  const stroke = STROKE;

  const wheels = paths.wheels
    .map(
      (w) => `
    <circle cx="${w.cx}" cy="${w.cy}" r="${w.r}" fill="#fff" stroke="${stroke}" stroke-width="2.2"/>
    <circle cx="${w.cx}" cy="${w.cy}" r="${w.r * 0.45}" fill="none" stroke="${stroke}" stroke-width="1.6"/>`,
    )
    .join("");

  const labels = panels
    .map(
      (p) =>
        `<text x="${p.lx}" y="${p.ly}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${p.fontSize ?? 8}" fill="${stroke}" font-weight="700">${p.label}</text>`,
    )
    .join("\n");

  const legend = options?.showLegend
    ? `
    <text x="16" y="130" transform="rotate(-90 16 130)" font-family="Arial, Helvetica, sans-serif" font-size="10" fill="${stroke}" font-weight="700">CÓDIGO DE IDENTIFICACIÓN</text>
    <text x="30" y="210" transform="rotate(-90 30 210)" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="${stroke}">0 = GOLPE</text>
    <text x="44" y="210" transform="rotate(-90 44 210)" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="${stroke}">+ = RAYON</text>
    <text x="58" y="210" transform="rotate(-90 58 210)" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="${stroke}">x = FALTANTE</text>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${PANEL_VIEWBOX.width} ${PANEL_VIEWBOX.height}">
  <rect width="100%" height="100%" fill="${PAPER}"/>
  <text x="170" y="24" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="${stroke}" font-weight="700">${bodyStyleTitle(style)}</text>
  ${legend}
  <path d="${paths.body}" fill="${FILL}" stroke="${stroke}" stroke-width="2.4"/>
  <path d="${paths.bumperFront}" fill="${FILL}" stroke="${stroke}" stroke-width="1.5"/>
  <path d="${paths.hood}" fill="${FILL}" stroke="${stroke}" stroke-width="1.5"/>
  <path d="${paths.fenderFL}" fill="${FILL}" stroke="${stroke}" stroke-width="1.4"/>
  <path d="${paths.fenderFR}" fill="${FILL}" stroke="${stroke}" stroke-width="1.4"/>
  <path d="${paths.doorFL}" fill="${FILL}" stroke="${stroke}" stroke-width="1.4"/>
  <path d="${paths.doorFR}" fill="${FILL}" stroke="${stroke}" stroke-width="1.4"/>
  <path d="${paths.stepL}" fill="${FILL}" stroke="${stroke}" stroke-width="1.3"/>
  <path d="${paths.stepR}" fill="${FILL}" stroke="${stroke}" stroke-width="1.3"/>
  <path d="${paths.roof}" fill="${FILL}" stroke="${stroke}" stroke-width="1.5"/>
  <path d="${paths.doorRL}" fill="${FILL}" stroke="${stroke}" stroke-width="1.4"/>
  <path d="${paths.doorRR}" fill="${FILL}" stroke="${stroke}" stroke-width="1.4"/>
  <path d="${paths.fenderRL}" fill="${FILL}" stroke="${stroke}" stroke-width="1.4"/>
  <path d="${paths.fenderRR}" fill="${FILL}" stroke="${stroke}" stroke-width="1.4"/>
  <path d="${paths.trunk}" fill="${FILL}" stroke="${stroke}" stroke-width="1.5"/>
  <path d="${paths.bumperRear}" fill="${FILL}" stroke="${stroke}" stroke-width="1.5"/>
  ${wheels}
  ${labels}
</svg>`;
}
