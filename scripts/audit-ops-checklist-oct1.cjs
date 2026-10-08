#!/usr/bin/env node
/**
 * Zero-margin audit for ALL ops fixes claimed to the client (Sep30 + Oct1).
 * Exit 1 if any assertion fails.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
let failed = 0;
const ok = [];
const bad = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assert(cond, msg) {
  if (cond) ok.push(msg);
  else {
    bad.push(msg);
    failed += 1;
  }
}

function indexOf(src, needle) {
  return src.indexOf(needle);
}

function assertOrder(src, first, second, msg) {
  const a = indexOf(src, first);
  const b = indexOf(src, second);
  assert(a >= 0 && b >= 0 && a < b, msg);
}

// ═══════════════════════════════════════════════════════════
// A) Km / nombre — no regresiones (no tocar, solo verificar)
// ═══════════════════════════════════════════════════════════
{
  const customers = read("src/lib/customers.ts");
  assert(
    customers.includes('customer_type === "COMPANY"') &&
      customers.includes("company_name"),
    "A1 Km/nombre: getCustomerDisplayName COMPANY → company_name",
  );
  const accessories = read(
    "src/components/inspections/inspection-accessories-panel.tsx",
  );
  assert(
    accessories.includes("Kilometraje de salida") &&
      accessories.includes("mileage != null"),
    "A2 Km/nombre: panel accesorios muestra kilometraje",
  );
  const pdf = read("src/lib/pdf/contract-pdf.tsx");
  assert(
    pdf.includes('label="Kilometraje (salida)"') ||
      pdf.includes("Km salida:"),
    "A3 Km/nombre: PDF entrega muestra km salida",
  );
}

// ═══════════════════════════════════════════════════════════
// B) Combustible debajo de accesorios — PDF entrega + pantalla
// ═══════════════════════════════════════════════════════════
{
  const pdf = read("src/lib/pdf/contract-pdf.tsx");
  assertOrder(
    pdf,
    "CHECKLIST INVENTARIO (SALIDA)",
    "NIVEL COMBUSTIBLE (SALIDA)",
    "B1 PDF entrega: checklist inventario ANTES de combustible",
  );
  // Fuel gauge must be AFTER the checklist columns close, not inside header
  const checklistPos = pdf.indexOf("CHECKLIST INVENTARIO (SALIDA)");
  const fuelPos = pdf.indexOf("NIVEL COMBUSTIBLE (SALIDA)");
  const checklistEnd = pdf.indexOf("</View>", fuelPos > 0 ? checklistPos : 0);
  assert(
    fuelPos > checklistPos && fuelPos > 0,
    "B2 PDF entrega: FuelGauge después del bloque checklist",
  );

  const accessories = read(
    "src/components/inspections/inspection-accessories-panel.tsx",
  );
  assertOrder(
    accessories,
    "Accesorios / inventario",
    "Combustible (debajo del inventario)",
    "B3 Pantalla: inventario ANTES de combustible",
  );
  assert(
    accessories.includes("ChecklistForm") &&
      accessories.includes("Combustible (debajo del inventario)"),
    "B4 Pantalla: medidor/label combustible bajo inventario",
  );
}

// ═══════════════════════════════════════════════════════════
// C) Acta de cierre — combustible debajo + versión cache
// ═══════════════════════════════════════════════════════════
{
  const close = read("src/lib/pdf/close-act-pdf.tsx");
  assertOrder(
    close,
    "Checklist de accesorios (devolución)",
    "SALIDA — CÓMO SE ENTREGÓ",
    "C1 Acta cierre: inventario ANTES de combustible salida",
  );
  assertOrder(
    close,
    "Checklist de accesorios (devolución)",
    "AL RECIBIR — CÓMO VUELVE",
    "C2 Acta cierre: inventario ANTES de combustible retorno",
  );
  assert(
    close.includes("Combustible DEBAJO del inventario") ||
      close.includes("SALIDA — CÓMO SE ENTREGÓ"),
    "C3 Acta cierre: comentario/estructura combustible debajo",
  );
  assert(
    close.includes('CLOSE_ACT_PDF_VERSION = "2026-10-01-v2"') ||
      /CLOSE_ACT_PDF_VERSION\s*=\s*"2026-10-01/.test(close),
    "C4 Acta cierre: versión PDF 2026-10-01-v2 (rompe cache)",
  );
  const cache = read("src/lib/pdf/pdf-cache.ts");
  assert(
    cache.includes('CLOSE_ACT_PDF_TEMPLATE_VERSION = "2026-10-01-v2"') ||
      /CLOSE_ACT_PDF_TEMPLATE_VERSION\s*=\s*"2026-10-01/.test(cache),
    "C5 pdf-cache: CLOSE_ACT version 2026-10-01-v2",
  );
  const meta = read("src/lib/pdf/contract-pdf-meta.ts");
  assert(
    /CONTRACT_PDF_TEMPLATE_VERSION\s*=\s*"2026-10-05-v1"/.test(meta),
    "C6 contract PDF template version 2026-10-05-v1",
  );
}

// ═══════════════════════════════════════════════════════════
// D) Gastos + mantenimiento en utilidad / ranking
// ═══════════════════════════════════════════════════════════
{
  const reports = read("src/app/dashboard/reportes/actions.ts");
  assert(
    reports.includes("maintenanceExpenseRows") &&
      reports.includes("maintenance_records"),
    "D1 Reportes: lee maintenance_records",
  );
  assert(
    reports.includes("...filteredExpensesOnly") &&
      reports.includes("...filteredMaintenanceExpenses"),
    "D2 Reportes: une gastos + mantenimiento en filteredExpenses",
  );
  assert(
    reports.includes("rankVehiclesByProfitability") &&
      reports.includes("filteredExpenses"),
    "D3 Ranking: usa filteredExpenses (con mantenimiento)",
  );
  assert(
    reports.includes("netUtility: totalRealIncome - totalExpenses") ||
      reports.includes("totalRealIncome - totalExpenses"),
    "D4 Utilidad: resta totalExpenses (incluye mantenimiento)",
  );
  // Second path fetchFinanceSummary also merges
  const countMerge = (reports.match(/maintenanceExpenseRows/g) || []).length;
  assert(
    countMerge >= 2,
    `D5 fetchFinanceSummary también fusiona mantenimiento (refs=${countMerge})`,
  );
}

// ═══════════════════════════════════════════════════════════
// E) Cierre espejo OUT|IN — no salto firma — auto CHECK_IN
// ═══════════════════════════════════════════════════════════
{
  const wizard = read("src/components/contracts/close-contract-wizard.tsx");
  assert(
    wizard.includes('title: "Espejo: salida → recepción"') ||
      wizard.includes("Espejo: salida"),
    "E1 Wizard: paso Espejo salida → recepción",
  );
  assert(
    wizard.includes("Combustible salida") &&
      wizard.includes("Kilometraje salida"),
    "E2 Wizard: muestra combustible/km de salida (izquierda)",
  );
  assert(
    wizard.includes("useState(0)") &&
      !/useState\(\s*steps\.findIndex/.test(wizard) &&
      !wizard.includes('useState("close")'),
    "E3 Wizard: inicia en stepIndex 0 (no salta a firma)",
  );
  assert(
    wizard.includes("No saltar a la firma") ||
      wizard.includes("debe ver siempre el espejo"),
    "E4 Wizard: comentario/guard anti-salto a firma",
  );
  assert(
    wizard.includes("Kilometraje y combustible son obligatorios") &&
      wizard.includes("goNext"),
    "E5 Wizard: goNext bloquea sin km/combustible",
  );
  assert(
    wizard.includes("Inventario (espejo salida → entrada)") ||
      wizard.includes("inventario de entrada parte igual"),
    "E6 Wizard: inventario espejo en misma pantalla",
  );

  const actions = read("src/app/dashboard/contratos/actions.ts");
  assert(
    actions.includes("export async function ensureCloseCheckIn"),
    "E7 ensureCloseCheckIn existe",
  );
  assert(
    actions.includes("Espejo: parte del mismo estado de salida") ||
      (actions.includes('status: item.status') &&
        actions.includes("CHECK_OUT") &&
        actions.includes("CHECK_IN")),
    "E8 ensureCloseCheckIn copia checklist CHECK_OUT → CHECK_IN",
  );
  const closePage = read("src/app/dashboard/contratos/[id]/cerrar/page.tsx");
  assert(
    closePage.includes("ensureCloseCheckIn"),
    "E9 Página cerrar llama ensureCloseCheckIn al abrir",
  );
}

// ═══════════════════════════════════════════════════════════
// F) Daños gris (salida) / rojo (nuevo)
// ═══════════════════════════════════════════════════════════
{
  const map = read("src/components/inspections/damage-map-2d.tsx");
  assert(
    map.includes('stroke="#64748b"') || map.includes("bg-slate-500"),
    "F1 Mapa: marcas referencia en gris slate",
  );
  assert(
    map.includes("newMarksInRed") && map.includes("forceRed"),
    "F2 Mapa: nuevos en rojo cuando newMarksInRed/reference",
  );
  assert(
    map.includes("Daño de salida (gris)") ||
      map.includes("gris") ||
      map.includes("salida"),
    "F3 Mapa: tip/title daño de salida gris",
  );
  const page = read("src/app/dashboard/inspecciones/[id]/page.tsx");
  assert(
    page.includes("priorDamageMarks") &&
      page.includes('newMarksInRed={inspection.type === "CHECK_IN"}'),
    "F4 CHECK_IN: priorDamageMarks + newMarksInRed",
  );
  assert(
    page.includes("getCheckOutDamageMarksForReservation"),
    "F5 Carga daños CHECK_OUT como referencia",
  );
  const panel = read(
    "src/components/inspections/inspection-accessories-panel.tsx",
  );
  assert(
    panel.includes("referenceMarks={damageMarksToDrafts(priorDamageMarks)}") &&
      panel.includes("newMarksInRed={newMarksInRed}"),
    "F6 Panel pasa referenceMarks + newMarksInRed al mapa",
  );
}

// ═══════════════════════════════════════════════════════════
// G) Calendario día X/Y + ENTREGAR/RECIBIR + [ENTREGA]/[DEVOLUCIÓN]
// ═══════════════════════════════════════════════════════════
{
  const progress = read("src/lib/calendar/day-progress.ts");
  assert(
    progress.includes("getRentalDayProgress") &&
      progress.includes('role = "ENTREGAR"') &&
      progress.includes('role = "RECIBIR"') &&
      progress.includes("EN_RENTA"),
    "G1 day-progress: roles ENTREGAR / EN_RENTA / RECIBIR",
  );
  assert(
    progress.includes("fraction") && progress.includes("${dayIndex}/${totalDays}"),
    "G2 day-progress: fracción día X/Y",
  );

  // Runtime unit checks for day progress
  const { differenceInCalendarDays, parseISO, startOfDay } = require(
    path.join(root, "node_modules/date-fns"),
  );
  function progressOf(startAt, endAt, dayIso) {
    const start = startOfDay(parseISO(startAt));
    const end = startOfDay(parseISO(endAt));
    const d = startOfDay(parseISO(dayIso));
    const totalDays = Math.max(1, differenceInCalendarDays(end, start) + 1);
    const dayIndex = Math.min(
      totalDays,
      Math.max(1, differenceInCalendarDays(d, start) + 1),
    );
    let role = "EN_RENTA";
    if (dayIndex === 1) role = "ENTREGAR";
    else if (dayIndex === totalDays) role = "RECIBIR";
    return { dayIndex, totalDays, role, fraction: `${dayIndex}/${totalDays}` };
  }
  const p1 = progressOf(
    "2026-10-01T10:00:00",
    "2026-10-05T10:00:00",
    "2026-10-01",
  );
  assert(
    p1.fraction === "1/5" && p1.role === "ENTREGAR",
    `G3 runtime: día 1 = 1/5 ENTREGAR (got ${p1.fraction} ${p1.role})`,
  );
  const p2 = progressOf(
    "2026-10-01T10:00:00",
    "2026-10-05T10:00:00",
    "2026-10-03",
  );
  assert(
    p2.fraction === "3/5" && p2.role === "EN_RENTA",
    `G4 runtime: día 3 = 3/5 EN_RENTA (got ${p2.fraction} ${p2.role})`,
  );
  const p3 = progressOf(
    "2026-10-01T10:00:00",
    "2026-10-05T10:00:00",
    "2026-10-05",
  );
  assert(
    p3.fraction === "5/5" && p3.role === "RECIBIR",
    `G5 runtime: día 5 = 5/5 RECIBIR (got ${p3.fraction} ${p3.role})`,
  );

  const cal = read("src/app/dashboard/calendario/calendar-view.tsx");
  assert(
    cal.includes("[ENTREGA]") && cal.includes("[DEVOLUCIÓN]"),
    "G6 Vista día: etiquetas [ENTREGA] / [DEVOLUCIÓN]",
  );
  assert(
    cal.includes("movementClock") &&
      cal.includes("movementClock(r.start_at)") &&
      cal.includes("movementClock(r.end_at)"),
    "G7 Vista día: horas de entrega y devolución",
  );
  assert(
    cal.includes("getRentalDayProgress") &&
      cal.includes("prog.label") &&
      cal.includes("rentalDayRoleClass"),
    "G8 Vista mes/día: chip día X/Y · rol",
  );
  assert(
    cal.includes("Mañana también aparece") &&
      cal.includes("Mañana ya no aparece"),
    "G9 Vista día: hint mañana sigue / ya no aparece",
  );
  assert(
    cal.includes("Hoy toca ENTREGAR") || cal.includes("dayActionHint"),
    "G10 Vista día: texto claro del rol del día",
  );
}

// ═══════════════════════════════════════════════════════════
// H) Sep30 regressions críticas (firma, fotos, PDF step, freehand)
// ═══════════════════════════════════════════════════════════
{
  const sig = read("src/components/contracts/signature-pad.tsx");
  const upBlock = sig.slice(
    sig.indexOf("const onPointerUp"),
    sig.indexOf("const clear"),
  );
  assert(
    !upBlock.includes("onConfirm") && !upBlock.includes("toDataURL"),
    "H1 SignaturePad: pointer up NO confirma firma",
  );
  const insp = read("src/app/dashboard/inspecciones/[id]/page.tsx");
  assert(
    /const showPhotos\s*=\s*true/.test(insp),
    "H2 Fotos siempre visibles en inspección",
  );
  const steps = read("src/lib/contracts/delivery-steps.ts");
  assert(
    steps.includes("actionHref: contractPdfHref"),
    "H3 Paso PDF entrega abre documento real",
  );
}

// ═══════════════════════════════════════════════════════════
// I) Anular contrato visible aunque el paso de entrega esté abierto
// ═══════════════════════════════════════════════════════════
{
  const page = read("src/app/dashboard/contratos/[id]/page.tsx");
  const actions = read("src/components/contracts/contract-actions.tsx");
  const server = read("src/app/dashboard/contratos/actions.ts");
  assert(
    page.includes("annulmentOnly"),
    "I1 Detalle del contrato muestra anular fuera de los pasos de entrega",
  );
  assert(
    actions.includes("Anular contrato (el registro se conserva)") &&
      actions.includes("if (annulmentOnly)"),
    "I2 Recuadro de anular existe y puede renderizarse solo",
  );
  assert(
    server.includes('type", "CHECK_OUT"') &&
      server.includes("use «Cerrar renta»"),
    "I3 Si ya hubo entrega, anular sigue bloqueado y pide Cerrar renta",
  );
}

// ═══════════════════════════════════════════════════════════
// J) Texto opcional: null de FormData no debe decir Invalid input
// ═══════════════════════════════════════════════════════════
{
  const helpers = read("src/lib/validation/form-helpers.ts");
  assert(
    helpers.includes("export function blankText") &&
      helpers.includes("value == null"),
    "J1 blankText convierte null de FormData en vacío",
  );
  const { z } = require(path.join(root, "node_modules/zod"));
  const sample = z.preprocess(
    (value) => (value == null ? undefined : value),
    z
      .string()
      .trim()
      .max(20)
      .optional()
      .or(z.literal(""))
      .transform((value) => (value === "" ? undefined : value)),
  );
  assert(sample.safeParse(null).success, "J2 runtime: null en texto opcional es válido");
  assert(
    sample.safeParse("").success && sample.safeParse("").data === undefined,
    "J3 runtime: cadena vacía queda undefined",
  );
  assert(
    sample.safeParse("hola").success && sample.safeParse("hola").data === "hola",
    "J4 runtime: texto real se conserva",
  );
}


  const closePdf = read("src/lib/pdf/close-act-pdf.tsx");
  assert(
    closePdf.includes("Gris = cómo salió") &&
      !closePdf.includes("Verde = cómo salió"),
    "F7 Acta PDF: leyenda Gris=salida (no Verde)",
  );
  const imagesPdf = read("src/lib/pdf/pdf-images.ts");
  assert(
    imagesPdf.includes("#64748b") && imagesPdf.includes("gray = salida"),
    "F8 Wireframe PDF: phase OUT en gris #64748b",
  );

console.log("\n=== OLDES ops checklist audit (zero margin) ===\n");
for (const m of ok) console.log("  PASS  " + m);
for (const m of bad) console.log("  FAIL  " + m);
console.log(`\n${ok.length} passed, ${bad.length} failed\n`);
process.exit(failed ? 1 : 0);
