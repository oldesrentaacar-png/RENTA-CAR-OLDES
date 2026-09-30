#!/usr/bin/env node
/**
 * Regression audit for Sep 30 delivery/ops fixes.
 * Fails (exit 1) if known bug patterns reappear in source.
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

// --- Signature: pointer up must NEVER call onConfirm ---
{
  const src = read("src/components/contracts/signature-pad.tsx");
  assert(
    src.includes("Confirmar firma") && src.includes("onConfirm(canvas.toDataURL"),
    "SignaturePad confirms only via Confirmar firma",
  );
  const upBlock = src.slice(
    src.indexOf("const onPointerUp"),
    src.indexOf("const clear"),
  );
  assert(
    !upBlock.includes("onConfirm") && !upBlock.includes("toDataURL"),
    "SignaturePad onPointerUp does not capture/save signature",
  );
  assert(
    src.includes("Puede levantar el dedo"),
    "SignaturePad instructs multi-stroke",
  );
}

// --- Photos always visible on inspection detail ---
{
  const src = read("src/app/dashboard/inspecciones/[id]/page.tsx");
  assert(
    /const showPhotos\s*=\s*true/.test(src),
    "Inspection detail always shows photos (showPhotos = true)",
  );
  assert(
    src.includes("mileage={inspection.mileage}"),
    "Inspection accessories panel receives mileage",
  );
  assert(src.includes('id="fotos"') || src.includes("Fotos del vehículo"), "Photos section present");
}

// --- Create inspection lands on photos step ---
{
  const src = read("src/components/inspections/inspection-create-form.tsx");
  assert(
    src.includes("paso=inspeccion-salida"),
    "New inspection redirects to inspeccion-salida (photos step)",
  );
}

// --- PDF step opens document ---
{
  const src = read("src/lib/contracts/delivery-steps.ts");
  assert(
    src.includes("actionHref: contractPdfHref"),
    "Delivery PDF step has actionHref to real PDF",
  );
  const nav = read("src/components/contracts/contract-delivery-navigator.tsx");
  assert(
    nav.includes("current.actionHref ?? current.href"),
    "Navigator primary button uses actionHref for PDF",
  );
}

// --- Freehand marks must not show #numbers in UI/PDF labels ---
{
  const map = read("src/components/inspections/damage-map-2d.tsx");
  assert(
    map.includes("Marcado libre (sin número)") || map.includes("sin número"),
    "Damage map freehand has unnumbered marker",
  );
  assert(
    !map.includes("`#${mark.markNumber} · Trazo libre`") &&
      !map.includes("#${mark.markNumber} Marcado libre"),
    "Damage map list/badge does not number freehand as Trazo libre #N",
  );
  const pdf = read("src/lib/pdf/contract-pdf.tsx");
  assert(
    !pdf.includes("#{mark.markNumber") && !pdf.includes("#${mark.markNumber"),
    "Contract PDF damage notes do not prefix #markNumber",
  );
  const close = read("src/app/dashboard/contratos/actions.ts");
  assert(
    close.includes('return note ? `Trazo libre — ${note}` : "Trazo libre"') ||
      close.includes("Trazo libre"),
    "Close-act damage lines treat freehand without #",
  );
  assert(
    !close.includes("`#${mark.markNumber} ${mark.symbol}"),
    "Close-act no longer uses #markNumber template",
  );
  const images = read("src/lib/pdf/pdf-images.ts");
  assert(
    images.includes("pathPoints.length >= 2) return null"),
    "PDF wireframe skips numbered pins on freehand strokes",
  );
}

// --- Mileage in PDF vehicle + checklist ---
{
  const pdf = read("src/lib/pdf/contract-pdf.tsx");
  assert(
    pdf.includes('label="Kilometraje (salida)"') && pdf.includes("mileageOut"),
    "PDF shows Kilometraje (salida) from mileageOut",
  );
  assert(
    pdf.includes("Km salida:"),
    "PDF checklist panel shows Km salida",
  );
  const accessories = read(
    "src/components/inspections/inspection-accessories-panel.tsx",
  );
  assert(
    accessories.includes("Kilometraje de salida"),
    "Accessories panel shows Kilometraje de salida beside inventory",
  );
}

// --- Customer display name helper used for contracts/inspections ---
{
  const customers = read("src/lib/customers.ts");
  assert(
    customers.includes('customer_type === "COMPANY"') &&
      customers.includes("company_name"),
    "getCustomerDisplayName prefers company_name for COMPANY",
  );
  const insp = read("src/app/dashboard/inspecciones/actions.ts");
  assert(
    insp.includes("getCustomerDisplayName"),
    "Inspection detail uses getCustomerDisplayName",
  );
  const contracts = read("src/app/dashboard/contratos/actions.ts");
  assert(
    contracts.includes("customerName: getCustomerDisplayName"),
    "Contract detail/PDF uses getCustomerDisplayName",
  );
  const pdfPage = read("src/app/dashboard/contratos/[id]/page.tsx");
  assert(
    !pdfPage.includes("{contract.vehicleLabel}\n                {\" · \"}\n                {contract.plate}"),
    "Contract delivery header does not duplicate plate after vehicleLabel",
  );
}

// --- Rate precision 6dp ---
{
  const money = read("src/lib/money.ts");
  assert(
    money.includes("RATE_DECIMALS = 6") && money.includes("parseRateInput"),
    "money.ts exposes RATE_DECIMALS=6 and parseRateInput",
  );
  // Runtime math with decimal.js from project
  const Decimal = require(path.join(root, "node_modules/decimal.js"));
  const rate = new Decimal("62.142857");
  const days = new Decimal(7);
  const product = rate.mul(days).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  assert(product === 435, `7 × 62.142857 = 435.00 (got ${product})`);
}

// --- Socios / por liquidar ---
{
  const phase = read("src/lib/contracts/display-phase.ts");
  assert(
    phase.includes("POR_LIQUIDAR") && phase.includes("balanceDue > 0.009"),
    "Display phase includes POR_LIQUIDAR for unpaid balances",
  );
  const form = read("src/components/forms/partner-rental-form.tsx");
  assert(
    form.includes("Traer datos") && form.includes("contract_code"),
    "Partner form can pull contract by code",
  );
  const mig40 = fs.existsSync(
    path.join(
      root,
      "supabase/migrations/20260930000040_partner_rentals_contract_link.sql",
    ),
  );
  const mig41 = fs.existsSync(
    path.join(root, "supabase/migrations/20260930000041_rate_precision_6dp.sql"),
  );
  assert(mig40, "Migration 040 partner_rentals contract link exists");
  assert(mig41, "Migration 041 rate precision 6dp exists");
}

console.log("\n=== OLDES Sep30 regression audit ===\n");
for (const m of ok) console.log("  OK  " + m);
for (const m of bad) console.log("  FAIL  " + m);
console.log(`\n${ok.length} passed, ${bad.length} failed\n`);
process.exit(failed ? 1 : 0);
